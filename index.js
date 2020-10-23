var port = 3000;
var saltRounds = 10;
var emailUsername = ""
var emailPassword = ""

//dependecies
const app = require("express")()
const express = require("express")
const fs = require("fs")
const http = require("http").createServer(app).listen(port, () => {
    console.log(`server listening on port: ${port}`)
})
const io = require("socket.io")(http)
const path = require("path")
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const formidable = require("formidable")
const paypal = require("paypal-rest-sdk");
const PDFDocument = require("pdfkit")

var approvedKeys = []

app.use(express.static(path.join(__dirname, "public")))

io.on("connection", (socket) => {
    socket.on("login", (username, password, rememberMe) => {
        var json = jsonRead("data/users.json")
        if(json){
            var found = false;
            var needConfirm = false
            json.forEach(user => {
                if(user.username == username && bcrypt.compareSync(password, user.password) && user.confirmation){
                    socket.emit("redir", "needConfirm.html")
                    needConfirm = true
                }
                else if(user.username == username && bcrypt.compareSync(password, user.password)){
                    var newObject = {
                        "username": username,
                        "key": Math.floor(Math.random() * 100000000000000000000),
                        "admin": user.admin
                    }
                    approvedKeys.push(newObject)
                    found = true
                    socket.emit("passwordCorrect", newObject.username, newObject.key, rememberMe)
                }
            })
            if(!found && !needConfirm){
                socket.emit("passwordWrong")
            }
        }
    })
    socket.on("register", (username, nonHashPassword) => {
        hash(nonHashPassword).then(function (password) {
            if (password == false) {
                socket.emit("eror", "500 internal server error, server could not secure your password and therefore registration was cancelled. ERR:HASHERR")
                return false
            }
            var json = jsonRead("data/users.json")
            var found = false
            json.forEach(user => {
                if (user.username == username) {
                    socket.emit("usernameExists")
                    found = true
                }
            })
            if (!found) {
                var newObject = {
                    "username": username,
                    "password": password,
                    "admin": false,
                    "confirmation": {
                        "id": Math.random()
                    }
                }
                json.push(newObject)
                var status = jsonWrite("data/users.json", json)
                if (status == false) {
                    socket.emit("eror", "somthing went wrong when saving your username to the database. ERR:DATABASEFAIL");
                    return false
                } else {
                    socket.emit("userCreated")
                }
                sendMail(newObject.username, "Confirm Email", `hello ${newObject.username} you can confirm you email by pressing this link: http://31.45.72.232/confirm.html?id=${newObject.confirmation.id}`)
            }
        })
    })
    socket.on("check", (username, key, needsAdminPerms) => {
        var found = false
        approvedKeys.forEach(approvedKey => {
            if (approvedKey.username == username && approvedKey.key == key) {
                if (needsAdminPerms && approvedKey.admin) {
                    found = true
                } else if (!needsAdminPerms) {
                    found = true
                }
            }
        })
        if (!found) {
            socket.emit("notAllowed")
        } else {
            socket.emit("allowed")
        }
    })
    socket.on("confirm", (id) => {
        var found = false
        var json = jsonRead("data/users.json")
        json.forEach(user => {
            if (user.confirmation) {
                if (user.confirmation.id == id) {
                    found = true
                    delete user["confirmation"]
                    jsonWrite("data/users.json", json)
                }
            }
        })
    })
    socket.on("requestProducts", () => {
        var json = jsonRead("data/products.json")
        socket.emit("products", JSON.stringify(json))
    })
    socket.on("requestSpesificProduct", (productName) => {
        var products = jsonRead("data/products.json")
        products.forEach(product => {
            if (product.name == productName) {
                socket.emit("spesificProduct", product)
            }
        })
    })
})

function jsonRead(file) {
    var data = fs.readFileSync(file, "utf-8")
    return JSON.parse(data)
}

function jsonWrite(file, data) {
    fs.writeFile(file, JSON.stringify(data), err => {
        if (err) {
            console.log(err);
            return false;
        } else {
            return true
        }
    })
}
async function hash(password) {
    try {
        var hashPassword = await bcrypt.hash(password, saltRounds)
        return hashPassword.toString()
    } catch (error) {
        console.log(error)
        return "error"
    }
}

function sendMail(reciver, emailSubject, message) {
    if (emailUsername) {
        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: emailUsername,
                pass: emailPassword
            }
        })
        let mailOptions = {
            from: emailUsername,
            to: reciver,
            subject: emailSubject,
            text: message + " This is an automated message. Please do not respond"
        }
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                log(error)
                return console.log(error)
            }
            log(`sent mail to ${reciver}`)
        })
    }
}

function log(msg, isErr) { //main logging function
    var date = new Date()
    var month = date.getMonth() + 1
    var firstMinutes = date.getMinutes()
    var minutes
    if (firstMinutes < 10) {
        minutes = "0" + firstMinutes
    } else {
        minutes = firstMinutes
    }
    var fullMsg = "[" + date.getDate() + "." + month + "." + date.getFullYear() + " @ " + date.getHours() + ":" + minutes + "] " + msg
    if (!msg) {
        log("tried to log with no message provided")
        return;
    }
    if (fs.existsSync("data/logs/log.log") && useLogs || fs.existsSync("data/logs/log.log") && isErr) {
        fs.appendFileSync("data/logs/log.log", fullMsg + "\r\n")
    } else if (useLogs && fs.existsSync("data/logs") || isErr && fs.existsSync("data/logs")) {
        fs.writeFileSync("data/logs/log.log", "[" + date.getDate() + "." + month + "." + date.getFullYear() + " @ " + date.getHours() + ":" + minutes + `] Log file created, to disable logging check the index.js file: config section. logging is currently: ${useLogs} \r\n`)
        fs.appendFileSync("data/logs/log.log", fullMsg + "\r\n")
    } else if (useLogs || isErr) {
        fs.mkdirSync("data/logs")
        fs.writeFileSync("data/logs/log.log", "[" + date.getDate() + "." + month + "." + date.getFullYear() + " @ " + date.getHours() + ":" + minutes + `] Log file created, to disable logging check the index.js file: config section. logging is currently: ${useLogs} \r\n`)
        fs.appendFileSync("data/logs/log.log", fullMsg + "\r\n")
    }
}
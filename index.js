//paypal dependecy. Trengs her for initialization av paypal variabel før paypal.configure in //instilinger
const paypal = require("paypal-rest-sdk");
const dotenv = require("dotenv").config()


//instillinger.
var port = process.env.PORT;
var saltRounds = +process.env.SALT;
var emailUsername = process.env.EMAIL
var emailPassword = process.env.EMAILPASSWORD
var websiteLink = process.env.DOMAIN //Brukes når det blir sendt ut mail om Feks. bekrefting av email. IKKE INKLUDER PORT!! HUSK http://  !!  fin ip på https://whatismyipaddress.com/
var supportMail = process.env.EMAIL //Mailen som oppdateringer til for ekspempel kontakt oss blir sendt til
var useLogs = process.env.USELOGS;

paypal.configure({
    "mode": process.env.PAYPAL_MODE, // skiftes til realtime når vi kommer inn i deploment
    "client_id": process.env.PAYPAL_ID, //disse to leder til "gard docs" DISSE MÅ ENDRES TIL JONNI SIN PAYPAL
    "client_secret": process.env.PAYPAL_SECRET
})

//dependecies
const app = require("express")()
const express = require("express")
const fs = require("fs")

var options = {
    key: fs.readFileSync("private.pem"),
    cert: fs.readFileSync("certificate.pem")
}

const https = require("https").createServer(options, app).listen(port, () => {
    console.log(`server listening on port: ${port}`)
})
const http = express();
const io = require("socket.io")(https)
const path = require("path")
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const formidable = require("formidable")
const PDFDocument = require("pdfkit");
const {
    isFunction
} = require("util");
var approvedKeys = []

http.get('*', function(req, res) {  
    res.redirect('https://' + req.headers.host + req.url); //redirecter alle http requests til https
}).listen(80)
app.post("/newProduct", (req, res) => { //brukes for opplastning av nye produkt
    var formData = new formidable.IncomingForm()
    formData.parse(req, (err, fields, files) => {
        var extension = files.file.name.substr(files.file.name.lastIndexOf("."))
        var newPath = "public/images/productPics/" + fields.ProductName.split(" ").join("-") + extension
        if (fs.existsSync(newPath)) {
            res.write("Product name allready exists")
            res.end()

        } else {
            fs.rename(files.file.path, newPath, function (error) {
                if (error) {
                    throw error
                } else {
                    res.redirect("/admin.html?fileSent=true")
                    var newObject = {
                        "name": fields.ProductName.split(" ").join("-"),
                        "cost": +fields.cost,
                        "picFileLoc": newPath
                    }
                    var json = jsonRead("data/colors.json")
                    json.push(newObject)
                    jsonWrite("data/colors.json", json)
                }
            })
        }
    })
})

app.get("/success", (req, res) => { //paypal betalings prosess
    if (!req.query.product) {
        res.send("Missing product name. You have not been charged. Please try again")
        res.end()
    } else if (!req.query.email) {
        res.send("missing email. You have not been charged!. Please go back to the main page and redoo the whole process")
        res.end()
    } else {
        var paymentId
        var payerId
        var ammount
        var execute_payment_json
        var products = jsonRead("data/colors.json")
        products.forEach(product => {
            if (product.color.replace("%20", " ") == req.query.product) {
                ammount = product.price
            }
        })
        if (!ammount) {
            res.send("somthing went wrong when proccessing your request. You have not been charged")
            res.end()
            return false;
        } else {
            payerId = req.query.PayerID;
            paymentId = req.query.paymentId;

            execute_payment_json = {
                "payer_id": payerId,
                "transactions": [{
                    "amount": {
                        "currency": "NOK",
                        "total": ammount
                    }
                }]
            };
        }
        paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
            if (error) {
                res.send("somthing went wrong when proccessing your request. You have not been charged")
                res.end()
            } else {

                var genInfo = jsonRead("data/genInfo.json")
                sendMail(req.query.email, `Ordre bekreftelse`, `hei ${req.query.email}, vi har mottat din bestiling på "${req.query.product}", referansenummer: ${genInfo.nextOrderID}. Du kommer til å få en ny mail av oss når pakken er sendt. Hvis du lurer på noe er det bare å ta kontakt med oss: ${websiteLink}:${port}/Kontakt-Oss.html`)
                res.redirect("TransactionCompleted.html")
                res.end()
                var newObject = {
                    "orderID": genInfo.nextOrderID,
                    "Item": req.query.product,
                    "email": req.query.email,
                    "shipping": {
                        "name": payment.payer.payer_info.shipping_address.recipient_name,
                        "adress": payment.payer.payer_info.shipping_address.line1,
                        "city": payment.payer.payer_info.shipping_address.city,
                        "postal": payment.payer.payer_info.shipping_address.postal_code
                    }
                }
                var orders = jsonRead("data/waitingOrders.json")
                orders.push(newObject)
                jsonWrite("data/waitingOrders.json", orders)
                io.sockets.emit("newOrder", newObject)


                var allOrders = jsonRead("data/allOrders.json")
                newObject = {
                    "refrence": genInfo.nextOrderID,
                    "name": payment.payer.payer_info.shipping_address.recipient_name,
                    "item": req.query.product,
                    "status": "venter på avsending"
                }
                allOrders.push(newObject)
                jsonWrite("data/allOrders.json", allOrders)
                genInfo.nextOrderID++
                jsonWrite("data/genInfo.json", genInfo)
            }
        })
    }
}) //slutt av betalingsprosess

app.use(express.static(path.join(__dirname, "public")))

io.on("connection", (socket) => {
    socket.on("login", (username, password, rememberMe) => {
        var json = jsonRead("data/users.json")
        if (json) {
            var found = false;
            var needConfirm = false
            var superAdmin = false
            json.forEach(user => {
                if (user.username == username && bcrypt.compareSync(password, user.password) && user.confirmation) {
                    socket.emit("redir", "AccountCreated.html")
                    needConfirm = true
                } else if (user.username == username && bcrypt.compareSync(password, user.password)) {
                    if (user.superAdmin) {
                        superAdmin = true
                    }
                    var newObject = {
                        "username": username,
                        "key": Math.floor(Math.random() * 100000000000000000000),
                        "admin": user.admin,
                        "superAdmin": superAdmin
                    }
                    approvedKeys.push(newObject)
                    found = true
                    socket.emit("passwordCorrect", newObject.username, newObject.key, rememberMe)
                }
            })
            if (!found && !needConfirm) {
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
                sendMail(newObject.username, "Confirm Email", `hello ${newObject.username} you can confirm you email by pressing this link: ${websiteLink}:${port}/AccountConfirmed.html?id=${newObject.confirmation.id}`)
            }
        })
    })
    socket.on("check", (username, key, needsAdminPerms, needsSuperAdmin) => {
        var found = false
        var superAdmin = false
        approvedKeys.forEach(approvedKey => {
            if (approvedKey.username == username && approvedKey.key == key) {
                if (approvedKey.superAdmin) {
                    superAdmin = true
                }
                if (needsAdminPerms && approvedKey.admin) {
                    found = true
                } else if (!needsAdminPerms) {
                    found = true
                }
            }
        })
        if (!found) {
            socket.emit("notAllowed")
        } else if (needsSuperAdmin && found) {
            socket.emit("allowed", superAdmin)
        } else if (found) {
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
        if (!found) {
            socket.emit("notConfirmed")
        }
    })
    socket.on("requestProducts", () => {
        var json = jsonRead("data/colors.json")
        socket.emit("products", JSON.stringify(json))
    })
    socket.on("requestSpesificProduct", (productName) => {
        var products = jsonRead("data/colors.json")
        products.forEach(product => {
            if (product.color == productName) {
                socket.emit("spesificProduct", product)
            }
        })
    })
    socket.on("newEmail", (email) => {
        var users = jsonRead("data/users.json")
        var found = false
        users.forEach(user => {
            if (user.username == email && user.confirmation) {
                sendMail(email, "Confirm Email", `hello ${email} you can confirm you email by pressing this link: ${websiteLink}:${port}/confirm.html?id=${user.confirmation.id}`)
                socket.emit("newMailSent")
                found = true
            }
        })
        if (!found) {
            socket.emit("eror", "Could not send email. Please double check the email you supplied")
        }
    })
    socket.on("kontakt", (name, email, message) => {
        if (name, email, message) {
            sendMail(supportMail, "Ny melding fra kontakt oss", `Melding fra: ${name}. Melding: ${message}   navn: ${name}. email: ${email}`)
            sendMail(email, "PEG UB kontakt", `hei ${name}! Vi har mottat din melding og tar kontakt med deg så fort som mulig.`)
        }
    })
    socket.on("buy", (productName, email, key) => {
        if (check(email, key)) {
            var products = jsonRead("data/colors.json")
            products.forEach(product => {
                if (product.color == productName) {
                    var actualName = product.color.replace("%20", " ")
                    const create_payment_json = {
                        "intent": "sale",
                        "payer": {
                            "payment_method": "paypal"
                        },
                        "redirect_urls": {
                            "return_url": `${websiteLink}:${port}/success?product=${productName}&email=${email}`,
                            "cancel_url": `${websiteLink}:${port}/cancel.html`
                        },
                        "transactions": [{
                            "item_list": {
                                "items": [{
                                    "name": actualName,
                                    "sku": "001",
                                    "price": product.price,
                                    "currency": "NOK",
                                    "quantity": 1
                                }]
                            },
                            "amount": {
                                "currency": "NOK",
                                "total": product.price
                            },
                            "description": actualName
                        }]
                    };
                    paypal.payment.create(create_payment_json, function (error, payment) {
                        if (error) {
                            console.error(error)
                        } else {
                            for (var i = 0; i < payment.links.length; i++) {
                                if (payment.links[i].rel == "approval_url") {
                                    socket.emit("redir", payment.links[i].href)
                                }
                            }
                        }
                    })
                }
            })
        }
        else{
            socket.emit("redir", "Logg-Inn.html")
        }
    })
    socket.on("requestWaitingOrders", () => {
        var orders = jsonRead("data/waitingOrders.json")
        socket.emit("waitingOrders", JSON.stringify(orders))
    })
    socket.on("getPDF", id => {
        var orders = jsonRead("data/waitingOrders.json")
        orders.forEach(order => {
            if (order.orderID == id) {
                if (!fs.existsSync(`public/images/pdfs/shippment${id}.pdf`)) {
                    var doc = new PDFDocument;
                    doc.pipe(fs.createWriteStream(`public/images/pdfs/shippment${id}.pdf`))
                    doc.text(order.shipping.name)
                    doc.text(order.shipping.adress)
                    doc.text(order.shipping.postal + " " + order.shipping.city)
                    doc.end()
                }
                socket.emit("PDF", `images/pdfs/shippment${id}.pdf`)
            }
        })
    })
    socket.on("ItemShipped", (id, username, key) => {
        var loggedIn = check(username, key)
        if (!loggedIn) {
            socket.emit("redir", "Logg-Inn.html")
        } else if (loggedIn[0] == true) {
            var orders = jsonRead("data/waitingOrders.json")
            var index = 0;
            orders.forEach(order => {
                if (id == order.orderID) {
                    sendMail(order.email, "Your order has shipped!", `hi ${order.email}, we have some great news for you. Your order of "${order.Item}" has shipped!`)
                    orders.splice(index, 1)
                    jsonWrite("data/waitingOrders.json", orders)
                    var allOrders = jsonRead("data/allOrders.json")
                    allOrders.forEach(allOrder => {
                        if (allOrder.refrence == id) {
                            allOrder.status = "Gjenstand bekreftet sendt av betjener"
                        }
                    })
                    jsonWrite("data/allorders.json", allOrders)
                    io.sockets.emit("RemoveItem", id)
                    if (fs.existsSync(`public/images/pdfs/shippment${order.orderID}.pdf`)) {
                        fs.unlinkSync(`public/images/pdfs/shippment${order.orderID}.pdf`)
                    }
                }
                index++
            })
        } else {
            socket.emit("redir", "/")
        }
    })
    socket.on("refrenceSearch", string => {
        var ordersToSend = []
        var orders = jsonRead("data/allOrders.json")
        orders.forEach(order => {
            if ((order.refrence + '').includes(string) && (order.refrence + '').length >= string) {
                ordersToSend.push(order)
            } else if (order.name.toLowerCase().includes(string.toLowerCase()) && order.name.length >= string.length) {
                ordersToSend.push(order)
            }
        })
        socket.emit("searchReturn", ordersToSend)
    })
    socket.on("getUsers", (string, username, key) => {
        var loggedIn = check(username, key)
        if (loggedIn) {
            if (loggedIn[0]) {
                var superAdmin = loggedIn[1]
                var response = []
                var users = jsonRead("data/users.json")
                users.forEach(user => {
                    if (superAdmin) {
                        if (user.username.toLowerCase().includes(string.toLowerCase()) && user.username.length >= string.length) {
                            var newObject = {
                                "username": user.username,
                                "isAdmin": user.admin
                            }
                            response.push(newObject)
                        }
                    }
                })
                socket.emit("userReturn", response)
            }
        }
    })
    socket.on("addAdmin", (username, key, adminToAdd) => {
        var loggedIn = check(username, key)
        if (loggedIn) {
            if (loggedIn[0] == true && loggedIn[1] == true) {
                var users = jsonRead("data/users.json")
                users.forEach(user => {
                    if (user.username == adminToAdd) {
                        user.admin = true
                        log(`administrator ${username} la til ${adminToAdd} som administrator`)
                        socket.emit("adminAdded")
                        jsonWrite("data/users.json", users)
                        for (var i = 0; i < approvedKeys.length; i++) {
                            if (approvedKeys[i].username == adminToAdd) {
                                approvedKeys.splice(i, 1)
                            }
                        }
                    }
                })
            } else {
                socket.emit("redir", "/")
            }
        } else {
            socket.emit("redir", "login.html")
        }
    })
    socket.on("removeAdmin", (username, key, adminToRemove) => {
        var loggedIn = check(username, key)
        if (loggedIn) {
            if (loggedIn) {
                if (loggedIn[0] && loggedIn[1]) {
                    var users = jsonRead("data/users.json")
                    users.forEach(user => {
                        if (user.username == adminToRemove) {
                            user.admin = false
                            user.superAdmin = false
                            log(`administrator ${username} fjernet ${adminToRemove} fra administrator rollen`)
                            jsonWrite("data/users.json", users)
                            socket.emit("adminRemoved")
                            for (var i = 0; i < approvedKeys.length; i++) {
                                if (approvedKeys[i].username == adminToRemove) {
                                    approvedKeys.splice(i, 1)
                                }
                            }
                        }
                    })
                } else {
                    socket.emit("redir", "/")
                }
            }
        } else {
            socket.emit("redir", "Logg-Inn.html")
        }
    })
    socket.on("addColor", (color, price, username, key) => {
        var loggedIn = check(username, key)
        if (loggedIn) {
            var exists = false
            if (loggedIn[0]) {
                var colors = jsonRead("data/colors.json")
                colors.forEach(colorFromDatabase => {
                    if (colorFromDatabase.color == color) {
                        socket.emit("sendMSG", "Denne fargen finnes allerede. Hvis du vil endre pris venligst fjern fargen i listen under og oprett den deretter på nytt")
                        exists = true
                    }
                })
                if (!exists) {
                    var updatedColor = encodeURIComponent(color.trim())
                    var newObject = {
                        "color": updatedColor,
                        "price": price
                    }
                    colors.push(newObject)
                    jsonWrite("data/colors.json", colors)
                    socket.emit("colorAdded")
                }
            } else {
                socket.emit("redir", "/")
            }
        } else {
            socket.emit("redir", "Logg-Inn.html")
        }
    })
    socket.on("getAllColors", () => {
        var data = jsonRead("data/colors.json")
        if (data.length >= 1 || data == undefined) {
            socket.emit("colorsReturn", data)
        }
        else{
            socket.emit("colorsReturn", false)
        }
    })
    socket.on("removeColor", (color, username, key) => {
        var loggedin = check(username, key)
        if (loggedin) {
            if (loggedin[0]) {
                var colors = jsonRead("data/colors.json")
                for (var i = 0; i < colors.length; i++) {
                    if (colors[i].color == color) {
                        colors.splice(i, 1)
                        jsonWrite("data/colors.json", colors)
                        socket.emit("colorDeleted")
                    }
                }
            } else {
                socket.emit("redir", "/")
            }
        } else {
            socket.emit("redir", "Logg-Inn.html")
        }
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
            text: message + " Dette er en automatisk sendt melding. Venligst ikke svar."
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

function check(username, key) {
    var loggedIn
    var admin
    var superAdmin
    approvedKeys.forEach(approvedKey => {
        if (approvedKey.username == username && approvedKey.key == key) {
            loggedIn = true
            admin = approvedKey.admin
            superAdmin = approvedKey.superAdmin
        }
    })
    if (loggedIn) {
        return [admin, superAdmin]
    } else {
        return false
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
(function () {
    var allFiles = [
        ["allOrders.json", "[]"],
        ["colors.json", "[]"],
        ["genInfo.json", '{"nextOrderID":0}'],
        ["users.json", "[]"],
        ["waitingOrders.json", "[]"]
    ]
    var statusSent = false;
    if (!fs.existsSync("data/")) {
        fs.mkdirSync("data/")
        console.log("\x1b[33m%s\x1b[0m", "Opretter Database.....")
        statusSent = true;
    }
    allFiles.forEach(file => {
        if (!fs.existsSync(`data/${file[0]}`)) {
            if (!statusSent) {
                console.log("\x1b[33m%s\x1b[0m", "Opretter Database.....")
                statusSent = true
            }
            jsonWrite(`data/${file[0]}`, JSON.parse(file[1]))
        }
    })
    if (statusSent) {
        console.log("\x1b[32m%s\x1b[0m", "Database Oprettet!")
    }
})()
//paypal dependecy. Trengs her for initialization av paypal variabel før paypal.configure in //instilinger
const paypal = require("paypal-rest-sdk");

//instillinger.
var port = 3000;
var saltRounds = 10;
var emailUsername = "gardsoreng@gmail.com"
var emailPassword = "rsipavzavgfeveqe"
var websiteLink = "http://localhost"  //Brukes når det blir sendt ut mail om Feks. bekrefting av email. IKKE INKLUDER PORT!! HUSK http://  !!  fin ip på https://whatismyipaddress.com/
var supportMail = "gardsoreng@gmail.com" //Mailen som oppdateringer til for ekspempel kontakt oss blir sendt til
var useLogs = true;

paypal.configure({
    "mode": "sandbox", // skiftes til realtime når vi kommer inn i deploment
    "client_id": "AeY4EnVK7UJ_2AxR66cY_zXDrOAHjZq0TLVqnkpFY6BkwrOvdMXF9sYl44MAPcREP7ccuY-8dUxTB9cn",  //disse to leder til "gard docs" DISSE MÅ ENDRES TIL JONNI SIN PAYPAL
    "client_secret": "EAqK2uTsxgJVVWD3Gy1JWIWvoDqJVMHf9s9yIWsbsSM-CYNnxGWf19wiAKkoT2CNMmdA9Q4ptNS-iU5G"
})

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
const PDFDocument = require("pdfkit")

var approvedKeys = []

app.post("/newProduct", (req, res) => {   //brukes for opplastning av nye produkt
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
                    var json = jsonRead("data/products.json")
                    json.push(newObject)
                    jsonWrite("data/products.json", json)
                }
            })
        }
    })
})

app.get("/success", (req, res) => { //paypal betalings prosess
    if (!req.query.product) {
        res.send("Missing product name. You have not been charged. Please try again")
        res.end()
    }
    else if(!req.query.email){
        res.send("missing email. You have not been charged!. Please go back to the main page and redoo the whole process")
        res.end()
    }
     else {
        var paymentId
        var payerId
        var ammount
        var execute_payment_json
        var products = jsonRead("data/products.json")
        products.forEach(product => {
            if (product.name.replace("%20", " ") == req.query.product) {
                ammount = product.cost
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
                    "orderID":genInfo.nextOrderID,
                    "Item":req.query.product,
                    "email":req.query.email,
                    "shipping":{
                        "name":payment.payer.payer_info.shipping_address.recipient_name,
                        "adress": payment.payer.payer_info.shipping_address.line1,
                        "city":payment.payer.payer_info.shipping_address.city,
                        "postal":payment.payer.payer_info.shipping_address.postal_code
                    }
                }
                var orders = jsonRead("data/waitingOrders.json")
                orders.push(newObject)
                jsonWrite("data/waitingOrders.json", orders)
                io.sockets.emit("newOrder", newObject)

                
                var allOrders = jsonRead("data/allOrders.json")
                newObject = {
                    "refrence":genInfo.nextOrderID,
                    "name":payment.payer.payer_info.shipping_address.recipient_name,
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
})//slutt av betalingsprosess

app.use(express.static(path.join(__dirname, "public")))

io.on("connection", (socket) => {
    socket.on("login", (username, password, rememberMe) => {
        var json = jsonRead("data/users.json")
        if(json){
            var found = false;
            var needConfirm = false
            var superAdmin = false
            json.forEach(user => {
                if(user.username == username && bcrypt.compareSync(password, user.password) && user.confirmation){
                    socket.emit("redir", "AccountCreated.html")
                    needConfirm = true
                }
                else if(user.username == username && bcrypt.compareSync(password, user.password)){
                    if(user.superAdmin){
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
                sendMail(newObject.username, "Confirm Email", `hello ${newObject.username} you can confirm you email by pressing this link: ${websiteLink}:${port}/AccountConfirmed.html?id=${newObject.confirmation.id}`)
            }
        })
    })
    socket.on("check", (username, key, needsAdminPerms, needsSuperAdmin) => {
        var found = false
        var superAdmin = false
        approvedKeys.forEach(approvedKey => {
            if (approvedKey.username == username && approvedKey.key == key) {
                if(approvedKey.superAdmin){
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
        } else if(needsSuperAdmin && found) {
            socket.emit("allowed", superAdmin)
            console.log(superAdmin)
        }
        else if(found){
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
        if(!found){
            socket.emit("notConfirmed")
        }
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
        if(name, email, message){
            sendMail(supportMail, "Ny melding fra kontakt oss", `Melding fra: ${name}. Melding: ${message}   navn: ${name}. email: ${email}`)
            sendMail(email, "PEG UB kontakt", `hei ${name}! Vi har mottat din melding og tar kontakt med deg så fort som mulig.`)
        }
    })
    socket.on("buy", (productName, email) => {
        var products = jsonRead("data/products.json")
        products.forEach(product => {
            if (product.name == productName) {
                var actualName = product.name.replace("%20", " ")
                const create_payment_json = {
                    "intent": "sale",
                    "payer": {
                        "payment_method": "paypal"
                    },
                    "redirect_urls": {
                        "return_url": `${websiteLink}:${port}/success?product=${productName}&email=${email}`,
                        "cancel_url": `${websiteLink}:${port}/cancel`
                    },
                    "transactions": [{
                        "item_list": {
                            "items": [{
                                "name": actualName,
                                "sku": "001",
                                "price": product.cost,
                                "currency": "NOK",
                                "quantity": 1
                            }]
                        },
                        "amount": {
                            "currency": "NOK",
                            "total": product.cost
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
    })
    socket.on("requestWaitingOrders", () => {
        var orders = jsonRead("data/waitingOrders.json")
        socket.emit("waitingOrders", JSON.stringify(orders))
    })
    socket.on("getPDF", id => {
        var orders = jsonRead("data/waitingOrders.json")
        orders.forEach(order => {
            if(order.orderID == id){
                if(!fs.existsSync(`public/images/pdfs/shippment${id}.pdf`)){
                var doc = new PDFDocument;
                doc.pipe(fs.createWriteStream(`public/images/pdfs/shippment${id}.pdf`))
                doc.text(order.shipping.name)
                doc.text(order.shipping.adress)
                doc.text(order.shipping.postal+" "+order.shipping.city)
                doc.end()
                }
                socket.emit("PDF", `images/pdfs/shippment${id}.pdf`)
            }
        })
    })
    socket.on("ItemShipped", id => {
        var orders = jsonRead("data/waitingOrders.json")
        var index = 0;
        orders.forEach(order => {
            if(id == order.orderID){
                sendMail(order.email, "Your order has shipped!", `hi ${order.email}, we have some great news for you. Your order of "${order.Item}" has shipped!`)
                orders.splice(index, 1)
                jsonWrite("data/waitingOrders.json", orders)
                var allOrders = jsonRead("data/allOrders.json")
                allOrders.forEach(allOrder => {
                    if(allOrder.refrence == id){
                        allOrder.status = "Gjenstand bekreftet sendt av betjener"
                    }
                })
                jsonWrite("data/allorders.json", allOrders)
                io.sockets.emit("RemoveItem", id)
                if(fs.existsSync(`public/images/pdfs/shippment${order.orderID}.pdf`)){
                    fs.unlinkSync(`public/images/pdfs/shippment${order.orderID}.pdf`)
                }
            }
            index++
        })
    })
    socket.on("refrenceSearch", string => {
        var ordersToSend = []
        var orders = jsonRead("data/allOrders.json")
        orders.forEach(order => {
            console.log()
            if((order.refrence+'').includes(string) && (order.refrence+'').length >= string){
                ordersToSend.push(order)
            }
            else if(order.name.toLowerCase().includes(string.toLowerCase()) && order.name.length >= string.length){
                ordersToSend.push(order)
            }
        })
        console.log(ordersToSend)
        socket.emit("searchReturn", ordersToSend)
    })
    socket.on("getUsers", (string) => {
        var response = []
        var users = jsonRead("data/users.json")
        users.forEach(user => {
            if(user.username.toLowerCase().includes(string.toLowerCase()) && user.username.length >= string.length){
                var newObject = {
                    "username":user.username
                }
                response.push(newObject)
            }
        })
        socket.emit("userReturn", response)
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
var socket = io()
console.log($("#loginForm"))
$("#loginForm").on("submit", function(e) {
    e.preventDefault();
    console.log("sent")
    if($("#email-4b87").val() != "" || $("#message-4b87").val() != ""){
        console.log($("#message-4b87").val())
        socket.emit("login", $("#email-4b87").val(), $("#message-4b87").val())
    }
})
socket.on("passwordCorrect", (username, key) => {
    localStorage.setItem("username", username)
    localStorage.setItem("key", key)
    window.location.href = "Butikk.html"
})
socket.on("passwordWrong", () => {
    document.getElementById("loginStatus").hidden = false
})
(function(){
    if(localStorage.getItem("username") && localStorage.getItem("key")){
        socket.emit("check", localStorage.getItem("username"), localStorage.getItem("key"))
    }
})()
socket.on("allowed", () => {
    window.location.href = "Butikk.html"
})
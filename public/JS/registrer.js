var socket = io()

$("#registerForm").on("submit", e => {
    e.preventDefault()
    if($("#passord1").val() == $("#passord2").val()){
        document.getElementById("status").hidden = true;
        socket.emit("register", $("#email").val(), $("#passord1").val())
    }
    else{
        document.getElementById("status").innerHTML = "Passord er ikke like!"
        document.getElementById("status").hidden = false;
    }
})
socket.on("usernameExists", () => {
    document.getElementById("status").innerHTML = "Denne emailen er allerede registrert!"
    document.getElementById("status").hidden = false;
})
socket.on("userCreated", () => {
    window.location.href = "/AccountCreated.html"
})
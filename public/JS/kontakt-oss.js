var socket = io();
$("#form").on("submit", e => {
    e.preventDefault()
    if($("#name-3b9a").val() != "" && $("#email-3b9a").val() != "" && $("#message-3b9a").val() != ""){
        socket.emit("kontakt", $("#name-3b9a").val(), $("#email-3b9a").val(), $("#message-3b9a").val())
        document.getElementById("status").hidden = false
    }
})
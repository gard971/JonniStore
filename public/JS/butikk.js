var socket = io()

var request = ""

function buy(id){
    if(localStorage.getItem("username") && localStorage.getItem("key")){
        socket.emit("check", localStorage.getItem("username"), localStorage.getItem("key"))
        request = id
        document.getElementById("kjopKnapp").innerHTML = "..."
    }
    else{
        window.location.href= "Logg-inn.html"
    }
}
socket.on("allowed", () => {
    socket.emit("buy", request, localStorage.getItem("username"))
})
socket.on("notAllowed", () => {
    window.location.href = "Logg-inn.html"
})
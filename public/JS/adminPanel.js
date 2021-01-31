var socket = io();
(function(){
    if(localStorage.getItem("username"), localStorage.getItem("key")){
        socket.emit("check", localStorage.getItem("username"), localStorage.getItem("key"), true, true)
    }
    else if(sessionStorage.getItem("username"), sessionStorage.getItem("key"), true, true){
        socket.emit("check", sessionStorage.getItem("username"), sessionStorage.getItem("key"), true, true)
    }
    else{
        window.location.href="/"
    }
})()
socket.on("allowed", (superAdmin) =>{
    document.getElementById("panel").style.display = "inline"
    if(superAdmin){
        document.getElementById("addAdmin").style.display = "inline"
    }
})
socket.on("notAllowed", () => {
    window.location.href="index.html"
})
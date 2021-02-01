var socket = io();

(function () {
    if (sessionStorage.getItem("username") && sessionStorage.getItem("key")) {
        socket.emit("check", sessionStorage.getItem("username"), sessionStorage.getItem("key"), true, true)
    }
    else if (localStorage.getItem("username") && localStorage.getItem("key")) {
        socket.emit("check", localStorage.getItem("username"), localStorage.getItem("key"), true, true)
    }
    else{
        window.location.href="index.html"
    }
})()
socket.on("notAllowed", () => {
    window.location.href = "login.html"
})
socket.on("allowed", (superAdmin) => {
    if (!superAdmin) {
        window.location.href = "/"
    }
    else {

        document.getElementById("newAdminForm").style.display = "inline"
        document.getElementById("newAdminForm").addEventListener("submit", (e) => {
            e.preventDefault()
            var keys = getKeys()
            if(keys){
                socket.emit("getUsers", document.getElementById("searchBar").value, keys[0], keys[1])
            }
            else{
                window.location.href="Logg-Inn.html"
            }
        })
    }
})

socket.on("userReturn", users =>{
    display(users)
})
socket.on("adminAdded", () =>{
    alert("administrator lagt til")
    var keys = getKeys()
    if(keys){
        socket.emit("getUsers", document.getElementById("searchBar").value, keys[0], keys[1])
    }
    else{
        window.location.href="Logg-Inn.html"
    }
})
socket.on("adminRemoved", () => {
    alert("administrator fjernet")
    var keys = getKeys()
    if(keys){
        socket.emit("getUsers", document.getElementById("searchBar").value, keys[0], keys[1])
    }
    else{
        window.location.href="Logg-Inn.html"
    }
})
function display(list){
    while(document.getElementById("ul").firstChild){
        document.getElementById("ul").removeChild(document.getElementById("ul").firstChild)
    }
    var htmlString = list.map(object => {
        return `
                <li>
                    <p class="newEmail admin${object.isAdmin}">${object.username}</p>
                </li>
        `
    }).join("")
    document.getElementById("ul").innerHTML = htmlString
    var test = document.getElementsByClassName("newEmail")
    window.onmousemove = function (e) {
        var x = e.clientX,
            y = e.clientY;
        document.getElementById('tooltip').style.top = (y) + 'px';
        document.getElementById('tooltip').style.left = (x) + 'px';
    };
    var elements = document.getElementsByClassName("newEmail")
    for(var i = 0; i<elements.length; i++){
        elements[i].onmouseleave = function (e) {
            document.getElementById("tooltip").style.display = "none"
        }
        elements[i].onmouseenter = function (e) {
            document.getElementById("tooltip").style.display = "inline"
        }
        var email = elements[i].innerHTML
        elements[i].onclick = function(){
            addAdmin(email)
        }
    }
    var nonAdminElems = document.getElementsByClassName("admintrue")
    for(var i = 0; i<nonAdminElems.length; i++){
        nonAdminElems[i].onmouseenter = function(e){
            document.getElementById("tooltip").style.display = "inline"
            document.getElementById("tooltip").innerHTML = "Trykk for å fjerne administrator"
        }
        nonAdminElems[i].onmouseleave = function(e){
            document.getElementById("tooltip").style.display = "none"
            document.getElementById("tooltip").innerHTML = "Trykk for å legge til som admin"
        }
        var email = nonAdminElems[i].innerHTML
        nonAdminElems[i].onclick  = function(){
            removeAdmin(email)
        }
    }
    var elemWidth = document.getElementById("newAdminList").offsetWidth
    var marg = elemWidth/2;
    document.getElementById("newAdminList").style.marginLeft = `-${marg}`
}
function addAdmin(email){
    var keys = getKeys()
    var username
    var key
    if(keys){
        username = keys[0]
        key = keys[1]
    }
    else{
        window.location.href="Logg-Inn.html"
        return
    }
    socket.emit("addAdmin", username, key, email)
}
function removeAdmin(email){
    var keys = getKeys()
    var username
    var key
    if(keys){
        username = keys[0]
        key = keys[1]
    }
    else{
        window.location.href="Logg-Inn.html"
        return
    }
    socket.emit("removeAdmin", username, key, email)
}
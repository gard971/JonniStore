var socket = io();

(function () {
    if (sessionStorage.getItem("username") && sessionStorage.getItem("key")) {
        socket.emit("check", sessionStorage.getItem("username"), sessionStorage.getItem("key"), true, true)
    }
    else if (localStorage.getItem("username") && localStorage.getItem("key")) {
        socket.emit("check", localStorage.getItem("username"), localStorage.getItem("key"), true, true)
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
            socket.emit("getUsers", document.getElementById("searchBar").value)
        })
    }
})

socket.on("userReturn", users =>{
    display(users)
})
function display(list){
    while(document.getElementById("ul").firstChild){
        document.getElementById("ul").removeChild(document.getElementById("ul").firstChild)
    }
    var htmlString = list.map(object => {
        return `
            <div class="adressWrapper" onclick="redir('/info.html?id=${object.id}')">
                <li>
                    <p class="newEmail">${object.username}</p>
                </li>
            </div>
        `
    }).join("")
    document.getElementById("ul").innerHTML = htmlString
    var test = document.getElementsByClassName("newEmail")
    console.log(test)
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
    }

}
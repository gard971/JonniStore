var socket = io();

document.getElementById("newColor").addEventListener("submit", (e) => {
    e.preventDefault()
    var keys = getKeys()
    if(keys){
        var numbers = /^[0-9]+$/;
        if(document.getElementById("price").value.match(numbers)){
            socket.emit("addColor", document.getElementById("color").value, document.getElementById("price").value, keys[0], keys[1])
        }
        else{
            alert("Ikke et gyldig tall")
        }
    }
})

socket.on("allowed", () => {
    var newLoc = document.getElementById("existingColors").offsetWidth /2
    document.getElementById("existingColors").style.marginLeft = `-${newLoc}px`
    var keys = getKeys()
    if(keys){
        socket.emit("getAllColors")
    }
    else{
        window.location.href="Logg-Inn.html"
    }
})
socket.on("notAllowed", () => {
    window.location.href="Logg-Inn.html"
});
socket.on("colorsReturn", colors => {
    display(colors)
});
socket.on("colorAdded", () => {
    var keys = getKeys()
    if(keys){
        socket.emit("getAllColors", keys[0], keys[1])
    }
    else{
        window.location.href="Logg-Inn.html"
    }
});
socket.on("colorDeleted", () => {
    var keys = getKeys()
    if(keys){
        socket.emit("getAllColors", keys[0], keys[1])
    }
    else{
        window.location.href="Logg-Inn.html"
    }
});
(function(){
    check(true, false)
})()
function display(list){
    while(document.getElementById("existingColorsUL").firstChild){
        document.getElementById("existingColorsUL").removeChild(document.getElementById("existingColorsUL").firstChild)
    }
    var htmlString = list.map(object => {
        var updatedColor = object.color.split("%20").join(" ")
        console.log(updatedColor)
        return `
                <li class='LI' id='${object.color}'>
                    <p>Farge: ${updatedColor}</p>
                    <p>Pris: ${object.price}</p>
                </li>
        `
    }).join("")
    document.getElementById("existingColorsUL").innerHTML = htmlString
    var elems = document.getElementsByClassName("LI")
    for(var i=0; i<elems.length; i++){
        elems[i].onmouseenter = function(){
            document.getElementById("tooltip").style.display = "inline"
        }
        elems[i].onmouseleave = function(){
            document.getElementById("tooltip").style.display = "none"
        }
        elems[i].onclick = function(){
            removeColor(this.id)
        }
    }
}
function removeColor(color){
    var keys = getKeys()
    if(keys){
        socket.emit("removeColor", color, keys[0], keys[1])
        document.getElementById("tooltip").style.display = "none"
    }
}
window.onmousemove = function (e) {
    var x = e.clientX,
        y = e.clientY;
    document.getElementById('tooltip').style.top = (y + window.scrollY) + 'px';
    document.getElementById('tooltip').style.left = (x) + 'px';
};
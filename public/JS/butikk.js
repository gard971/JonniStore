var socket = io()

var request = ""

function buy(id) {
    var keys = getKeys()
    if (keys) {
        document.getElementById("kjopKnapp").innerHTML = "..."
        socket.emit("buy", id, keys[0], keys[1])
    }
}
socket.on("notAllowed", () => {
    window.location.href = "Logg-inn.html"
});
(function () {
    socket.emit("getAllColors")
})()
socket.on("colorsReturn", (colors) => {
    if (colors) {
        display(colors)
    }
})

function display(list) {
    while (document.getElementById("colorsSelect").firstChild) {
        document.getElementById("colorsSelect").removeChild(document.getElementById("colorsSelect").firstChild)
    }
    var opt = document.createElement("option")
    opt.selected = true
    opt.hidden = true
    opt.innerHTML = "Velg Farge"
    document.getElementById("colorsSelect").appendChild(opt)
    var htmlString = list.map(object => {
        var updatedColor = object.color.split("%20").join(" ")
        return `
                <option class='LI' id='${object.price}'>${updatedColor}</option>
        `
    }).join("")
    document.getElementById("colorsSelect").innerHTML += htmlString
}
document.getElementById("colorsSelect").onchange = function () {
    var updatedName = document.getElementById("colorsSelect").value.split(" ").join("%20")
    var element = document.getElementById("colorsSelect")
    var price = element.options[element.selectedIndex].id
    document.getElementById("price").innerHTML = `KR ${price}-,`
    console.log(updatedName)
    document.getElementById("kjopKnapp").onclick = function(){
        buy(updatedName)
    }
}
var socket = io()
document.getElementById("searchForm").addEventListener("submit", (e) => {
    e.preventDefault()
    socket.emit("refrenceSearch", document.getElementById("searchBar").value)
})
socket.on("searchReturn", items => {
    display(items)
})
function display(list){
    while(document.getElementById("ul").firstChild){
        document.getElementById("ul").removeChild(document.getElementById("ul").firstChild)
    }
    var htmlString = list.map(object => {
        return `
            <div class="adressWrapper" onclick="redir('/info.html?id=${object.id}')">
                <li>
                    <label>Ordre:</label>
                    <p>${object.refrence}</p>
                    <label>Ordre plassert av:</label>
                    <p>${object.name}</p>
                    <label>Gjenstand:</label>
                    <p>${object.item}</p>
                    <label>Ordre Status:</label>
                    <p>${object.status}</p>
                </li>
            </div>
        `
    }).join("")
    document.getElementById("ul").innerHTML = htmlString
}
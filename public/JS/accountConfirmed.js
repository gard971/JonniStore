const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var socket = io()

if(!urlParams.get("id")){
    alert("Noe gikk galt. Venligst lukk nettleseren din helt og prøv igjen. Hvis dette problemet vedvarer venligst kontakt oss med denne feilmeldingen: ERR:CONFIRMID")
}
else{
    socket.emit("confirm", urlParams.get("id"))
}
socket.on("notConfirmed", () => {
    alert("Noe gikk galt. Venligst lukk nettleseren din helt og prøv igjen. Hvis dette problemet vedvarer venligst kontakt oss med denne feilmeldingen: ERR:IDNOTRECOGNIZED")
})

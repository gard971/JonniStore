socket.on("eror", msg => {
    console.error(`500 internal server error. Server responded with the following message: ${msg}`)
})
socket.on("redir", loc => {
    window.location.href= loc
})
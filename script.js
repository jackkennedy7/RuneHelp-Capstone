const searchButton = document.getElementById('searchButton');
const searchInput = document.getElementById('searchInput');

searchButton.addEventListener('click', () => {
    const username = searchInput.value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }
    fetch(`https://runehelp.onrender.com/api/player/${username}`)
        .then(response => response.json())
        .then(data => {
            console.log("Backend response:", data);
        })
        .catch(error => {
            console.error("Error:", error);
        });
    
    // Fetch player stats from the backend
    //Needs to be implemented
});
<script>
    import { onMount } from 'svelte';
    import { userStore } from './userStore';

    let literatureList = $state([]); // Will receive literature data from navigation or store

    onMount(() => {
        const storedData = localStorage.getItem('literatureList');
        literatureList = storedData ? JSON.parse(storedData) : [];
    });

    // Function to remove literature by ISBN (or other unique identifier)
    function removeLiterature(isbn) {
        literatureList = literatureList.filter(item => item.isbn !== isbn);
        localStorage.setItem('literatureList', JSON.stringify(literatureList));
    }
</script>

<div class="library-container">
    <h1>Your Library</h1>

    {#if literatureList.length === 0}
        <p>No literature added yet. Go back and add some!</p>
    {:else}
        {#each literatureList as lit (lit.isbn)}
            <div class="literature-entry">
                <button class="remove-btn" onclick={() => removeLiterature(lit.isbn)}>✕</button>
                <strong>{lit.title}</strong> by {lit.author} <br />
                <em>ISBN: {lit.isbn}</em> <br />
                <p>{lit.comment}</p>
            </div>
        {/each}
    {/if}
</div>

<style>
    .library-container {
        padding: 20px;
        font-family: Arial, sans-serif;
    }

    .literature-entry {
        position: relative;
        background-color: lightgray;
        margin-bottom: 10px;
        padding: 10px;
        border-radius: 5px;
        display: flex;
        flex-direction: column;
    }

    .remove-btn {
        position: absolute;
        top: 5px;
        right: 5px;
        background: transparent;
        border: none;
        font-size: 1.2rem;
        color: darkred;
        cursor: pointer;
    }

    .remove-btn:hover {
        color: red;
    }
</style>
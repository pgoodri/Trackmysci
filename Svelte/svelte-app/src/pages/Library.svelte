<script>
    import { onMount } from 'svelte';

    let literatureList = [];

    onMount(() => {
        const storedData = localStorage.getItem('literatureList');
        literatureList = storedData ? JSON.parse(storedData) : [];
    });
</script>

<div class="library-container">
    <h1>Your Library</h1>

    {#if literatureList.length === 0}
        <p>No literature added yet. Go back and add some!</p>
    {:else}
        {#each literatureList as lit (lit.isbn)}
            <div class="literature-entry">
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
        background-color: lightgray;
        margin-bottom: 10px;
        padding: 10px;
        border-radius: 5px;
    }
</style>

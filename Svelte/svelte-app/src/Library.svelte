<script>
    import { onMount } from 'svelte';
    import { Button } from "$lib/components/ui/button";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

    let literatureList = [];

    // Load literature list from localStorage on mount
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

<nav class="bg-white border-neutral-400 shadow h-16 flex items-center justify-between px-12 sticky top-0 z-50">
    <h1 class="text-lg font-semibold text-neutral-800">TrackMySci</h1>
    <div class="flex items-center space-x-6">

    </div>
</nav>
<div class="p-12 bg-neutral-50 min-h-screen">
    <h1 class="text-4xl font-bold text-neutral-800 mb-6">Your Library</h1>

    {#if literatureList.length === 0}
    <div class="flex flex-col items-center justify-center text-center text-neutral-500 pt-12">
        <p class="text-lg font-medium">No literature added yet.</p>
        <p class="text-sm mt-2">Start by adding a new publication to track your progress!</p>
    </div>
    {:else}
        <div class="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {#each literatureList as lit (lit.isbn)}
                <div class="relative p-4 bg-white border border-neutral-200 rounded-lg shadow">
                    <!-- Remove button -->
                    <button
                        class="absolute top-3 right-3 text-red-500 hover:text-red-700 focus:outline-none"
                        onclick={() => removeLiterature(lit.isbn)}
                        aria-label="Remove"
                    >
                        ✕
                    </button>

                    <!-- Content -->
                    <h2 class="text-xl font-semibold text-neutral-800">{lit.title}</h2>
                    <p class="text-neutral-600">by {lit.author}</p>
                    <p class="text-sm text-neutral-500 italic mt-2">ISBN: {lit.isbn}</p>
                    {#if lit.comment}
                        <p class="text-neutral-700 mt-4">{lit.comment}</p>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>
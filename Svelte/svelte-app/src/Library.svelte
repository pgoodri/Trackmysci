<script>
    import { auth, firestore } from "./firebase";
    import { getDoc, doc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
    import { onAuthStateChanged } from "firebase/auth";
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import { LogOut, Gauge, Library, ChevronsUpDown, Edit, Trash2, Ellipsis, SquarePen } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import * as Popover from "$lib/components/ui/popover";
    import { Progress } from "$lib/components/ui/progress";
    import { signOut } from "firebase/auth";

    let firstName = "";
    let lastName = "";
    let authReady = false;
    let libraryList = [];

    async function fetchUserData(uid) {
        try {
            const userDoc = await getDoc(doc(firestore, "users", uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                firstName = userData.firstName || "";
                lastName = userData.lastName || "";
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }

    async function loadUserLibrary(uid) {
        try {
            const userDocRef = doc(firestore, "users", uid);
            const libraryRef = collection(userDocRef, "library");
            const q = query(libraryRef, where("userId", "==", uid));
            const querySnapshot = await getDocs(q);
            libraryList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching library:", error.message);
        }
    }

    async function deletePublication(entryId) {
        if (!confirm("Are you sure you want to delete this publication?")) return;
        try {
            const user = auth.currentUser;
            if (!user) {
                console.error("No authenticated user found.");
                return;
            }
            const userDocRef = doc(firestore, "users", user.uid);
            const entryDocRef = doc(collection(userDocRef, "library"), entryId);
            await deleteDoc(entryDocRef);
            console.log(`Deleted entry ${entryId}`);
            await loadUserLibrary(user.uid);
        } catch (error) {
            console.error("Error deleting entry:", error.message);
        }
    }

    function logout() {
        signOut(auth).then(() => {
            window.location.href = "/login";
        });
    }

    onMount(() => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                await fetchUserData(user.uid);
                await loadUserLibrary(user.uid);
            }
            authReady = true;
        });
    });
</script>

{#if !authReady}
    <div class="flex justify-center items-center h-screen bg-white">
        <p class="text-neutral-500 text-lg">Loading...</p>
    </div>
{:else}
    <div class="min-h-screen flex flex-col bg-stone-50">
        <!-- NAVBAR -->
        <nav class="bg-white border-neutral-400 shadow h-16 flex items-center justify-between px-12 sticky top-0 z-50">
            <h1 class="text-lg font-semibold text-neutral-800">TrackMySci</h1>
            <div class="flex items-center space-x-6">
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                        <button class="border border-neutral-300 py-2 px-4 shadow-sm text-base font-medium rounded hover:bg-neutral-100 flex items-center gap-x-5">
                            {firstName} {lastName}
                            <ChevronsUpDown class="w-4 h-4 text-neutral-800" />
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                        <DropdownMenu.Group>
                            <DropdownMenu.Item on:click={() => window.location.href = "/dashboard"} class="text-base">
                                <Gauge class="w-7 pr-1.5" /> Dashboard
                            </DropdownMenu.Item>
                            <DropdownMenu.Item on:click={() => window.location.href = "/library"} class="text-base">
                                <Library class="w-7 pr-1.5" /> Library
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item on:click={logout} class="text-red-500 text-base">
                                <LogOut class="w-7 pr-1.5 text-red-500" /> Logout
                            </DropdownMenu.Item>
                        </DropdownMenu.Group>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </div>
        </nav>

        <!-- PAGE CONTENT -->
        <div class="pt-12 px-12">
            <h2 class="text-4xl font-bold text-neutral-800">Library</h2>
        </div>

        <div class="flex flex-1">
            <section class="w-full py-12 px-12">
                {#if libraryList.length === 0}
                    <div class="flex flex-col items-center justify-center text-center text-gray-500 pt-12">
                        <p class="text-lg font-medium">No papers added yet.</p>
                        <p class="text-sm mt-2">Start by adding a new paper to track your reading!</p>
                    </div>
                {:else}
                    <!-- Grid layout for 3-column structure -->
                    <ul class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {#each libraryList as lit}
                        <li class="p-4 bg-white border border-neutral-300 rounded-md shadow">
                            <div class="flex justify-between">
                                <div class="cursor-pointer" on:click={() => openEditModal(lit)}>
                                    <strong>{lit.title}</strong><br />
                                    <small>{lit.author}</small>
                                </div>
                                <div>
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger>
                                            <button class="p-0.5 text-gray-800 hover:bg-gray-200 rounded-sm">
                                                <Ellipsis class="w-5 h-5" />
                                            </button>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content>
                                            <DropdownMenu.Group>
                                                <DropdownMenu.Item on:click={() => openEditModal(lit)} class="text-sm">
                                                    <Edit class="w-4 h-4 mr-2" /> Edit
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Item on:click={() => deletePublication(lit.id)} class="text-sm text-red-600">
                                                    <Trash2 class="w-4 h-4 mr-2" /> Delete
                                                </DropdownMenu.Item>
                                            </DropdownMenu.Group>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Root>
                                </div>
                            </div>
            
                            {#if lit.tags?.length > 0}
                                <div class="flex flex-wrap gap-2 mt-3">
                                    {#each lit.tags as tag}
                                        <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">{tag}</span>
                                    {/each}
                                </div>
                            {/if}
            
                            <div class="mt-1 flex items-center gap-3">
                                <div class="flex-1">
                                    <div class="flex justify-between text-sm text-neutral-600 mb-1">
                                        <span>
                                            {Math.min(100, Math.round(((lit.currentPage || lit.pageStart) - lit.pageStart) / (lit.pageEnd - lit.pageStart) * 100))}%
                                        </span>
                                    </div>
                                    <Progress value={Math.min(100, Math.round(((lit.currentPage || lit.pageStart) - lit.pageStart) / (lit.pageEnd - lit.pageStart) * 100))} />
                                </div>
                                <Popover.Root bind:open={lit.isUpdating}>
                                    <Popover.Trigger on:click={() => {
                                        lit.newCurrentPage = lit.currentPage || lit.pageStart;
                                        lit.progressComment = "";
                                        lit.isUpdating = true;
                                    }}>
                                        <button class="pt-6 pb-0 mb-0 bg-transparent text-neutral-900 hover:text-neutral-500 transition-all">
                                            <SquarePen />
                                        </button>
                                    </Popover.Trigger>
                                    <Popover.Content class="p-4 bg-white shadow-lg border rounded-md w-64">
                                        <div>
                                            <label class="text-sm font-medium text-neutral-700 mb-2 block">
                                                Current Page:
                                            </label>
                                            <input type="number" min={lit.pageStart} max={lit.pageEnd} bind:value={lit.newCurrentPage} class="w-full p-1 border rounded border-neutral-300 shadow-sm" />
                                            <label class="text-sm font-medium text-neutral-700 mt-2 block">
                                                Comment:
                                            </label>
                                            <textarea bind:value={lit.progressComment} class="w-full p-1 border rounded border-neutral-300 shadow-sm" placeholder="Add a note about your reading progress"></textarea>
                                        </div>
                                        <div class="flex justify-end mt-4">
                                            <Button on:click={async () => {
                                                await updateProgress(lit.id, lit.newCurrentPage, lit.pageStart, lit.progressComment);
                                                lit.isUpdating = false;
                                            }} class="bg-blue-600 hover:bg-blue-700 text-white">
                                                Save
                                            </Button>
                                        </div>
                                    </Popover.Content>
                                </Popover.Root>
                            </div>
                        </li>
                        {/each}
                    </ul>
                {/if}
            </section>
        </div>
    </div>
{/if}

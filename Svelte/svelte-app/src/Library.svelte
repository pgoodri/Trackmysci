<script>
    import { navigate } from "svelte-routing";
    import { auth } from "./firebase";
    import { signOut } from "firebase/auth";
    import { userStore } from "./userStore";
    import { Button } from "$lib/components/ui/button";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { Gauge, Library, LogOut, MoreVertical } from "lucide-svelte";

    let firstName = "Guest";
    let lastName = "";
    let user;

    userStore.subscribe((value) => {
        user = value;
        if (user) {
            firstName = user.firstName || "Guest";
            lastName = user.lastName || "";
        }
    });

    function logout() {
        signOut(auth).then(() => {
            userStore.set(null);
            navigate("/login");
        });
    }
</script>


<nav class="bg-white border-neutral-400 shadow h-16 flex items-center justify-between px-12 sticky top-0 z-50">
    <h1 class="text-lg font-semibold text-neutral-800">TrackMySci</h1>
    <div class="flex items-center space-x-6">
        <DropdownMenu.Root>
            <DropdownMenu.Trigger>
                <button class="border border-neutral-300 py-2 px-4 shadow-sm text-base font-medium rounded hover:bg-neutral-100 flex items-center gap-x-5">
                    {firstName + " " + lastName}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-neutral-500">
                        <path fill-rule="evenodd" d="M11.47 4.72a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 0 1-1.06 1.06L12 6.31 8.78 9.53a.75.75 0 0 1-1.06-1.06l3.75-3.75Zm-3.75 9.75a.75.75 0 0 1 1.06 0L12 17.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                    </svg>
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
                <DropdownMenu.Group>
                    <DropdownMenu.Item on:click={() => navigate("/dashboard")} class="text-base"> <Gauge class="w-7 pr-1.5"/> Dashboard</DropdownMenu.Item>
                    <DropdownMenu.Item on:click={() => navigate("/library")} class="text-base"> <Library class="w-7 pr-1.5"/>Library</DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item on:click={logout} class="text-red-500 text-base"><LogOut class="w-7 pr-1.5 text-red-500"/>Logout</DropdownMenu.Item>
                </DropdownMenu.Group>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </div>
</nav>

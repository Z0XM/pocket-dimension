<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Popover from "$lib/components/ui/popover";
  import { Progress } from "./ui/progress";

  const today = new Date();
  const noOfDaysInYear = today.getFullYear() % 4 === 0 ? 366 : 365;
  const todayCountOfDay = Math.ceil(
    (today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const session = authClient.useSession();
  const user = $derived($session.data?.user);

  let logoutPopoverOpen = $state(false);

  async function handleLogout() {
    await authClient.signOut();
    goto("/login");
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>
      <div class="text-2xl text-white">
        {today.toLocaleDateString("en-IN", { weekday: "long" })}
        <span class="text-primary">,</span>{" "}
        {today
          .toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
          .replace(/ /g, " ")}
      </div>
    </Card.Title>
    <Card.Description>
      <span class="text-xl text-white">{todayCountOfDay}</span>
      <span class="text-md text-gray-400">{` / ${noOfDaysInYear}`}</span>
    </Card.Description>
  </Card.Header>
  <Progress value={(todayCountOfDay / noOfDaysInYear) * 100} class="w-full" />
  <Card.Content class="px-6">
    <div class="text-2xl">
      <a href="/" class=" text-white cursor-pointer hover:underline">
        How Was Your Day</a
      >
      <Popover.Root bind:open={logoutPopoverOpen}>
        <Popover.Trigger>
          <span
            class="text-3xl font-bold text-primary cursor-pointer hover:underline"
            >{user?.username}</span
          >
        </Popover.Trigger>
        <Popover.Content class="w-auto">
          <div class="flex flex-col gap-3">
            <p class="text-sm font-medium">Are you sure you want to logout?</p>
            <div class="flex gap-2 justify-end">
              <Popover.Close>
                <Button variant="secondary" size="sm">Cancel</Button>
              </Popover.Close>
              <Button variant="destructive" size="sm" onclick={handleLogout}
                >Logout</Button
              >
            </div>
          </div>
        </Popover.Content>
      </Popover.Root>
      ?
    </div>
  </Card.Content>
</Card.Root>

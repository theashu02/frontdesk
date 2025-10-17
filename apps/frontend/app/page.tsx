import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex w-screen h-screen justify-center items-center">
      <ThemeToggle />
      <Button>Hello Front Desk</Button>
    </div>
  );
}

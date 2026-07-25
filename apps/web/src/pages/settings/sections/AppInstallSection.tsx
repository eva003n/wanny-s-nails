import { Button, Card } from "@/components/ui";
import {useInstallPromptContext } from "@/hooks/useInstallPrompt";

export function AppInstallSection() {
    const {isInstallable, promptInstall} = useInstallPromptContext()
    return (
      <Card className="grid gap-2">
        <p className="text-sm text-gray-500">
          Install the app on 8 your device
        </p>
        <Button
          variant="primary"
          onClick={promptInstall}
          disabled={isInstallable}
        >
          Install App
        </Button>
      </Card>
    );
}
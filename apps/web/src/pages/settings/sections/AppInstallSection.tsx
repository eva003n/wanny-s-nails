import { Button, Card } from "@/components/ui";
import {type InstallPromptContextValue } from "@/hooks/useInstallPrompt";

export function AppInstallSection({isInstallable, promptInstall}: InstallPromptContextValue) {
    return (
      <Card className="grid gap-2">
        <p className="text-sm text-gray-500">
          Install the app on  your device
        </p>
        <Button
          variant="primary"
          onClick={promptInstall}
          disabled={!isInstallable}
        >
          Install App
        </Button>
      </Card>
    );
}
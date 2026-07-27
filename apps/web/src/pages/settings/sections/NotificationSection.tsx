import { PushOptIn } from "@/components/PushOptIn";
import { Card } from "@/components/ui";
import { usePushSubscription } from "@/hooks/usePushSubscription";

export function NotificationSection() {
  const { status, loading, initializing, error, isSubscribed, subscriptionInfo, subscribe, unSubscribe } =
    usePushSubscription();

  return (
    <Card>
      <PushOptIn
        isSubscribed={isSubscribed}
        status={status}
        loading={loading}
        initializing={initializing}
        error={error}
        subscriptionInfo={subscriptionInfo}
        onSubscribe={subscribe}
        onUnSubscribe={unSubscribe}
      />
    </Card>
  );
}

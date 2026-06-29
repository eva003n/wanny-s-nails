import { createQueues } from "@wannys-nails/packages";
import { redis} from "./redis.js";

// queuss by producers 
export const {notificationQueue, conversationQueue, paymentQueue} = createQueues(redis)
import { createQueues } from "@wannys-nails/core";
import { redis} from "./redis.js";

// queuss by producers 
export const {notificationQueue, conversationQueue, paymentQueue} = createQueues(redis)
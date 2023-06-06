import * as dotenv from "dotenv";
dotenv.config({ path: "env/.env" });

import { Scheduler } from "./modules";
import { Config } from "./service/common/Config";
import { logger, Logger } from "./service/common/Logger";
import { BalanceScheduler } from "./service/scheduler/BalanceScheduler";
import { ScheduleServer } from "./service/ScheduleServer";

let server: ScheduleServer;

async function main() {
    // Create with the arguments and read from file
    const config = Config.createWithArgument();
    logger.add(Logger.defaultConsoleTransport());
    logger.transports.forEach((tp) => {
        tp.level = config.logging.level;
    });

    const schedulers: Scheduler[] = [];
    if (config.scheduler.enable) {
        const scheduler = config.scheduler.getScheduler("balance");
        if (scheduler && scheduler.enable) {
            schedulers.push(new BalanceScheduler(scheduler.expression));
        }
    }

    server = new ScheduleServer(config, schedulers);
    server.start().catch((error: any) => {
        // handle specific listen errors with friendly messages
        logger.error(`An error occurred while starting the server: ${error.stack}`);
        process.exit(1);
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

process.on("SIGINT", () => {
    server.stop().then(() => {
        process.exit(0);
    });
});

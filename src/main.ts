import * as dotenv from "dotenv";
dotenv.config({ path: "env/.env" });

import { Scheduler } from "./modules/scheduler/Scheduler";
import { Config } from "./service/common/Config";
import { logger, Logger } from "./service/common/Logger";
import { DefaultWebServer } from "./service/DefaultWebServer";
import { BalanceScheduler } from "./service/scheduler/BalanceScheduler";

let server: DefaultWebServer;

async function main() {
    // Create with the arguments and read from file
    const config = Config.createWithArgument();
    logger.add(Logger.defaultConsoleTransport());
    logger.transports.forEach((tp) => {
        tp.level = config.logging.level;
    });

    logger.info(`address: ${config.server.address}`);
    logger.info(`port: ${config.server.port}`);

    const schedulers: Scheduler[] = [];
    if (config.scheduler.enable) {
        const scheduler = config.scheduler.getScheduler("balance");
        if (scheduler && scheduler.enable) {
            schedulers.push(new BalanceScheduler(scheduler.expression));
        }
    }

    server = new DefaultWebServer(config, schedulers);
    return server.start().catch((error: any) => {
        // handle specific listen errors with friendly messages
        switch (error.code) {
            case "EACCES":
                logger.error(`${config.server.port} requires elevated privileges`);
                break;
            case "EADDRINUSE":
                logger.error(`Port ${config.server.port} is already in use`);
                break;
            default:
                logger.error(`An error occurred while starting the server: ${error.stack}`);
        }
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

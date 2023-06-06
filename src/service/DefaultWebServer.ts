import bodyParser from "body-parser";
import cors from "cors";
import { Scheduler } from "../modules/scheduler/Scheduler";
import { WebService } from "../modules/service/WebService";
import { Config } from "./common/Config";
import { cors_options } from "./option/cors";
import { DefaultRouter } from "./routers/DefaultRouter";

export class DefaultWebServer extends WebService {
    /**
     * The collection of schedulers
     * @protected
     */
    protected schedules: Scheduler[] = [];

    /**
     * The configuration of the database
     * @private
     */
    private readonly _config: Config;

    public readonly _router: DefaultRouter;

    /**
     * Constructor
     * @param config Configuration
     * @param storage Rollup Storage
     * @param schedules Array of IScheduler
     */
    constructor(config: Config, schedules?: Scheduler[]) {
        super(config.server.port, config.server.address);

        this._config = config;
        this._router = new DefaultRouter(this, config);

        if (schedules) {
            schedules.forEach((m) => this.schedules.push(m));
            this.schedules.forEach((m) =>
                m.setOption({
                    config: this._config,
                    router: this._router,
                })
            );
        }
    }

    /**
     * Setup and start the server
     */
    public async start(): Promise<void> {
        // parse application/x-www-form-urlencoded
        this.app.use(bodyParser.urlencoded({ extended: false, limit: "1mb" }));
        // parse application/json
        this.app.use(bodyParser.json({ limit: "1mb" }));
        this.app.use(cors(cors_options));

        this._router.registerRoutes();

        for (const m of this.schedules) await (m as Scheduler).start();

        return super.start();
    }

    public stop(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            for (const m of this.schedules) await m.stop();
            for (const m of this.schedules) await m.waitForStop();
            if (this.server != null) {
                this.server.close((err?) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else resolve();
        });
    }
}

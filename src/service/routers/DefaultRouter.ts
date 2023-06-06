import express from "express";
import { WebService } from "../../modules/service/WebService";
import { Config } from "../common/Config";
import { Metrics } from "../metrics/Metrics";
import { IValidatorInfo } from "../types";

export class DefaultRouter {
    /**
     *
     * @private
     */
    private _web_service: WebService;

    /**
     * The configuration of the database
     * @private
     */
    private readonly _config: Config;

    private metrics: Metrics;

    /**
     *
     * @param service  WebService
     * @param config Configuration
     */
    constructor(service: WebService, config: Config) {
        this._web_service = service;
        this._config = config;
        this.metrics = new Metrics();
        this.metrics.createGauge("validator_balance", "current validator balance", ["pubkey"]);
        this.metrics.createGauge("validator_withdrawal", "total validator withdrawal", ["pubkey"]);
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    /**
     * Make the response data
     * @param code      The result code
     * @param data      The result data
     * @param error     The error
     * @private
     */
    private static makeResponseData(code: number, data: any, error?: any): any {
        return {
            code,
            data,
            error,
        };
    }

    public storeMetrics(validators: IValidatorInfo[]) {
        for (const validator of validators) {
            this.metrics.gaugeLabels(
                "validator_balance",
                { pubkey: validator.publicKey },
                validator.balance / 1_000_000_000
            );
            this.metrics.gaugeLabels(
                "validator_withdrawal",
                { pubkey: validator.publicKey },
                validator.withdrawal / 1_000_000_000
            );
        }
    }

    public registerRoutes() {
        this.app.get("/", [], DefaultRouter.getHealthStatus.bind(this));
        this.app.get("/metrics", [], this.getMetrics.bind(this));
    }

    private static async getHealthStatus(req: express.Request, res: express.Response) {
        return res.json("OK");
    }

    /**
     * GET /metrics
     * @private
     */
    private async getMetrics(req: express.Request, res: express.Response) {
        res.set("Content-Type", this.metrics.contentType());
        res.end(await this.metrics.metrics());
    }
}

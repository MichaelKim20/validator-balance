import { Scheduler } from "../../modules";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { IValidatorInfo, IValidatorWithdrawal } from "../types";
import { Utils } from "../utils/Utils";

// @ts-ignore
import axios from "axios";
import { DefaultRouter } from "../routers/DefaultRouter";

// tslint:disable-next-line:no-var-requires
const parsePrometheusTextFormat = require("parse-prometheus-text-format");

interface IMetricsItem {
    name: string;
    help: string;
    type: string;
    metrics: IMetricsData[];
}
interface IMetricsData {
    value: string;
    labels: {
        pubkey: string;
    };
}

/**
 * Creates blocks at regular intervals and stores them in IPFS and databases.
 */
export class BalanceScheduler extends Scheduler {
    /**
     * The object containing the settings required to run
     */
    private _config: Config | undefined;

    private _router: DefaultRouter | undefined;

    /**
     *
     */
    private validators: IValidatorInfo[];
    private validatorKeys: string[];

    constructor(expression: string) {
        super(expression);
        this.validatorKeys = (process.env.VALIDATORS || "").split(",");
        this.validators = [];
    }

    /**
     * Returns the value if this._config is defined.
     * Otherwise, exit the process.
     */
    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    private get router(): DefaultRouter {
        if (this._router !== undefined) return this._router;
        else {
            logger.error("DefaultRouter is not ready yet.");
            process.exit(1);
        }
    }

    /**
     * Set up multiple objects for execution
     * @param options objects for execution
     */
    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.router && options.router instanceof DefaultRouter) this._router = options.router;
        }
    }

    /**
     * Called when the scheduler starts.
     */
    public async onStart() {
        //
    }

    /**
     * This function is repeatedly executed by the scheduler.
     * @protected
     */
    protected async work() {
        try {
            const latestSlot = (await this.getLatestSlot()) - 1;
            if (latestSlot <= 0) return;
            const validators: IValidatorInfo[] = [];

            this.validatorKeys = await this.getValidators();

            let success = 0;
            let fail = 0;
            for (const key of this.validatorKeys) {
                try {
                    const res = await this.getValidatorInfo(latestSlot, key);
                    validators.push(res);
                    success++;
                } catch (error) {
                    fail++;
                }
            }

            if (fail > 0) logger.error(`Success: ${success}, Fail: ${fail}`);

            if (validators.length > 0) {
                try {
                    const withdrawals = await this.getWithdrawals(latestSlot, validators.map((m) => m.index).join(","));
                    for (const withdrawal of withdrawals) {
                        const validator = validators.find((m) => m.index === withdrawal.index);
                        if (validator !== undefined) validator.withdrawal = withdrawal.withdrawal;
                    }
                } catch (error) {
                    logger.error(`Failed to getting validator withdrawal : ${error}`);
                }
            }

            this.validators = validators.sort((a, b) => {
                return a.index - b.index;
            });

            this.router.storeMetrics(this.validators);
        } catch (error) {
            logger.error(`Failed to execute the BalanceScheduler: ${error}`);
        }
    }

    private async getLatestSlot(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            const client = axios.create();
            const url = `${this.config.setting.agora_cl_node_url}/eth/v2/beacon/blocks/head`;
            client
                .get(url)
                .then((response) => {
                    const contents = response.data;
                    if (contents.data !== undefined && contents.data.message !== undefined) {
                        resolve(Number(contents.data.message.slot));
                    } else {
                        reject(new Error("Not found value."));
                    }
                })
                .catch((reason) => {
                    reject(reason);
                });
        });
    }

    private async getValidators(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            const client = axios.create();
            const url = `${this.config.setting.agora_cl_validator_metrics_url}/metrics`;
            client
                .get(url)
                .then((response) => {
                    const contents = response.data;
                    const lines = contents.split("\n");
                    const balanceLines: string[] = [];
                    let flag = false;
                    for (const line of lines) {
                        if (!flag) {
                            if (line.indexOf("# HELP validator_statuses") === 0) {
                                flag = true;
                                balanceLines.push(line);
                            }
                        } else {
                            if (line.indexOf("# TYPE validator_statuses") === 0) balanceLines.push(line);
                            if (line.indexOf("validator_statuses") === 0) balanceLines.push(line);
                        }
                    }
                    const data: IMetricsItem[] = parsePrometheusTextFormat(balanceLines.join("\n") + "\n");
                    if (data.length > 0) resolve(data[0].metrics.map((m) => m.labels.pubkey));
                    else {
                        reject(new Error("Not found value."));
                    }
                })
                .catch((reason) => {
                    reject(reason);
                });
        });
    }

    private async getValidatorInfo(slot: number, publicKey: string): Promise<IValidatorInfo> {
        return new Promise<IValidatorInfo>((resolve, reject) => {
            const client = axios.create();
            const url = `${
                this.config.setting.agora_cl_node_url
            }/eth/v1/beacon/states/${slot}/validators/${Utils.prefix0X(publicKey)}`;
            client
                .get(url)
                .then((response) => {
                    const contents = response.data;
                    if (contents.data && contents.data.index !== undefined && contents.data.balance !== undefined) {
                        resolve({
                            publicKey,
                            index: Number(contents.data.index),
                            balance: Number(contents.data.balance),
                            withdrawal: 0,
                        });
                    }
                })
                .catch((reason) => {
                    reject(reason);
                });
        });
    }

    private async getWithdrawals(slot: number, indexes: string): Promise<IValidatorWithdrawal[]> {
        return new Promise<IValidatorWithdrawal[]>((resolve, reject) => {
            const client = axios.create();
            const url = `${this.config.setting.agora_scan_url}/api/v1/validator/${indexes}/totalwithdrawals?slot=${slot}`;

            client
                .get(url)
                .then((response) => {
                    const contents = response.data;
                    const withdrawals: IValidatorWithdrawal[] = [];
                    if (contents.data !== null) {
                        for (const items of contents.data) {
                            withdrawals.push({
                                index: items.validatorindex,
                                withdrawal: items.sum,
                            });
                        }
                    }
                    resolve(withdrawals);
                })
                .catch((reason) => {
                    reject(reason);
                });
        });
    }
}

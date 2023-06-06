import { Config } from "../../src/service/common/Config";

import * as assert from "assert";
import path from "path";

describe("Test of Config", () => {
    it("Test parsing the settings of a string", async () => {
        const config: Config = new Config();
        config.readFromFile(path.resolve("tests", "service", "config.test.yaml"));

        assert.strictEqual(config.server.address, "0.0.0.0");
        assert.strictEqual(config.server.port, 7000);

        assert.strictEqual(config.logging.folder, path.resolve("logs"));
        assert.strictEqual(config.logging.level, "debug");

        assert.strictEqual(config.scheduler.enable, true);
        assert.strictEqual(config.scheduler.items.length, 1);
        assert.strictEqual(config.scheduler.items[0].name, "balance");
        assert.strictEqual(config.scheduler.items[0].enable, true);
        assert.strictEqual(config.scheduler.items[0].expression, "*/1 * * * * *");

        assert.strictEqual(config.setting.agora_scan_url, "http://localhost:3600");
        assert.strictEqual(config.setting.agora_cl_node_url, "http://localhost:3333");
    });
});

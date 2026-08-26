import { createPlayer, getPlayer, updatePlayer } from "../src/players.ts";
import { migrate } from "../src/schema.ts";
import { memoryDriver } from "./memory-driver.ts";

const driver = memoryDriver();
migrate(driver);
createPlayer(driver, { id: "1", name: "Old", createdAt: Date.now() });
console.log("Before:", getPlayer(driver, "1"));
updatePlayer(driver, "1", { name: "New", club: "Test" });
console.log("After name+club:", getPlayer(driver, "1"));
updatePlayer(driver, "1", { name: "Newer" });
console.log("After name only:", getPlayer(driver, "1"));
updatePlayer(driver, "1", { club: "" });
console.log("After club empty:", getPlayer(driver, "1"));
updatePlayer(driver, "1", { name: "" });
console.log("After name empty:", getPlayer(driver, "1"));

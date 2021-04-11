import * as BMath from "./bMath.js";
import {Player} from "./player.js";
import {Throwable} from "./throwable.js";
import {StateMachine} from "./stateMachine.js";
import * as Graphics from "./graphics.js";
import * as Phys from './basePhysics.js';
import * as Mechanics from './mechanics.js';

function ogmoRotateRectToTileOrigin(x, y, h, tileSize, rotation) {
    switch (rotation) {
        case 0: return{x:x,y:y};
        case 90: return{x:x-tileSize, y:y+tileSize-h};
        case 180: return{x:x-tileSize, y:y-h};
        case 270: return{x:x,y:y-h};
        default:
            console.warn("Error: incompatible direction:", rotation);
            return{x:x,y:y};
    }
}

function ogmoRotationToVec(rotation) {
    switch (rotation) {
        case 0: return BMath.VectorUp;
        case 90: return BMath.VectorLeft;
        case 180: return BMath.VectorDown;
        case 270: return BMath.VectorRight;
        default:
            console.warn("Error: incompatible direction:", rotation);
            return{x:x,y:y};
    }
}

const LAYER_TO_OBJ = {
    "rooms": (entity, spawnObjs, level) => new Room(entity["x"], entity["y"], entity["width"], entity["height"], level, spawnObjs, entity["id"]),
    "walls": (x, y, level, tileData, tileSize) => new Mechanics.Wall(x, y, tileSize, tileSize, level, tileData),
    "staticSpikes": (x, y, level, tileData, tileSize) => new Mechanics.PlayerKill(x, y + tileSize / 2 + 2, tileSize, 2, level, tileData),
    "playerSpawns": (entity, level, tileSize) => new Mechanics.PlayerSpawn(entity["x"], entity["y"] + tileSize / 2, tileSize, tileSize * 1.5, level, entity["id"], entity["values"]["roomId"]),
    "throwableSpawns": (entity, level, tileSize) => new Mechanics.ThrowableSpawn(entity["x"], entity["y"], tileSize, tileSize, level, entity["id"], entity["values"]["roomId"]),
    "mechanics": (entity, level, tileSize) => {
        switch(entity["name"]) {
            case "spring":
                console.log(entity["x"], entity["y"], tileSize, entity["rotation"]);
                const h = tileSize/8*2;
                console.log(ogmoRotateRectToTileOrigin(entity["x"], entity["y"], h, tileSize, entity["rotation"]), ogmoRotationToVec(entity["rotation"]));
                const newPos = ogmoRotateRectToTileOrigin(entity["x"], entity["y"], h, tileSize, entity["rotation"]);
                console.log();
                const ret = new Mechanics.Spring(newPos.x, newPos.y, tileSize, h, ogmoRotationToVec(entity["rotation"]), level);
                console.log(ret);
                return ret;
            default:
                break;
        }
    }
};

function getLayerDataByName(data, layerName) {
    return data["layers"].find(layerData => layerData["name"] === layerName)
}

class Level {
    constructor(data, game) {
        this.game = game;
        this.layers = {
            "rooms": new Phys.Layer(false),
            "walls": new Phys.Layer(true),
            "mechanics": new Phys.Layer(false),
            "staticSpikes": new Phys.Layer(true),
            "throwables": new Phys.Layer(false),
            "player": new Phys.Layer(false),
            // "switchBlocks": new Phys.Layer(false),
        };
        // convertWallTiles(tileArr);

        this.globalStaticLayerNames = ["walls", "staticSpikes", "mechanics"];
        this.globalStaticLayerNames.forEach(layerName => {
            this.setLayerFromData(layerName, data);
        });

        const roomLayerData = getLayerDataByName(data, "rooms");
        const spawnLayerNames = ["playerSpawns", "throwableSpawns"];
        roomLayerData["entities"].forEach(roomEntity => {
            const roomId = roomEntity["id"];
            const spawnObjs = {};
            spawnLayerNames.forEach(spawnLayerName => {
                spawnObjs[spawnLayerName] = this.getSpawnsByRoomId(roomId, spawnLayerName, data);
            });
            this.layers["rooms"].pushObj(LAYER_TO_OBJ["rooms"](roomEntity, spawnObjs, this));
        });

        this.forEachLayer(layer => {
            layer.sortObjs();
        });
        this.layers["rooms"].objs.sort((a, b) => a["id"] - b["id"]);
        this.curRoom = this.layers["rooms"].objs[0];
        this.curRoom.stateMachine.transitionTo("spawn");
    }

    /** Returns a list of spawn objects that match the corresponding room id.*/
    getSpawnsByRoomId(roomId, spawnLayerName, data) {
        let ret = [];
        getLayerDataByName(data, spawnLayerName)["entities"].forEach(entity => {
            if (entity["values"]["roomId"] === roomId) ret.push(LAYER_TO_OBJ[spawnLayerName](entity, this, Graphics.TILE_SIZE));
        });
        return ret;
    }

    getGame() {
        return this.game;
    }

    drawAll() {
        // this.decorations.forEach(curItem => {curItem.draw();});
        if(Phys.DEBUG) this.curRoom.draw();
        this.forEachLayerNotRooms(layer => layer.drawAll());
        this.curRoom.drawAll();
        // console.log(this.getPlayer().getXVelocity(), this.getThrowables()[1].getXVelocity());
    }

    setLayerFromData(layerName, data) {
        const layer = getLayerDataByName(data, layerName);
        const yLen = layer["gridCellsY"];
        const xLen = layer["gridCellsX"];
        const gridCellWidth = Graphics.TILE_SIZE;
        const layerObjs = layer["data2D"];
        const entities = layer["entities"];
        const dataCoords = layer["dataCoords2D"];
        if (layerObjs) {
            for (let y = 0; y < yLen - 1; y++) {
                for (let x = 0; x < xLen; x++) {
                    const gameSpaceX = x * gridCellWidth;
                    const gameSpaceY = y * gridCellWidth;
                    const tileCode = parseInt(layerObjs[y][x]);
                    if (tileCode === 0 || tileCode === -1) {
                    } else {
                        const newObj = LAYER_TO_OBJ[layerName](gameSpaceX, gameSpaceY, this, tileCode, gridCellWidth);
                        this.layers[layerName].pushObj(newObj);
                    }
                }
            }
        } else if (dataCoords) {
            for (let y = 0; y < yLen - 1; y++) {
                for (let x = 0; x < xLen; x++) {
                    const gameSpaceX = x * gridCellWidth;
                    const gameSpaceY = y * gridCellWidth;
                    const tileArr = dataCoords[y][x];
                    if (tileArr[0] === -1 || (tileArr[0] === 0 && tileArr[0] === 0)) {
                    } else {
                        const newObj = LAYER_TO_OBJ[layerName](gameSpaceX, gameSpaceY, this, tileArr, gridCellWidth);
                        this.layers[layerName].pushObj(newObj);
                    }
                }
            }
        } else if (entities) {
            entities.forEach(entity => {
                const newObj = LAYER_TO_OBJ[layerName](entity, this, gridCellWidth);
                this.layers[layerName].pushObj(newObj);
            })
        }
    }

    forEachLayer(f) {
        Object.keys(this.layers).forEach(k => {
            f(this.layers[k]);
        });
    }

    forEachLayerNotRooms(f) {
        Object.keys(this.layers).filter(layerName => layerName !== "rooms").forEach(k => {
            f(this.layers[k]);
        });
    }

    forEachActorLayer(f) {
        f(this.layers["player"]);
    }

    setPlayer(p) {
        this.layers["player"].objs = [p];
    }

    getPlayer() {
        return this.layers["player"].objs && this.layers["player"].objs[0] ? this.layers["player"].objs[0] : null;
    }

    setThrowables(arr) {
        this.layers["throwables"].objs = arr;
    }

    getThrowables() {return this.layers["throwables"].objs}

    killPlayer(x, y) {
        this.curRoom.killPlayer(x, y);
        this.game.death();
        // audioCon.playSoundEffect(DEATH_SFX);
    }

    setKeys(keys) {
        this.getCurRoom().setKeys(keys);
    }

    update() {
        try {
            this.forEachLayerNotRooms(layer => layer.update());
            this.getCurRoom().update();
        } catch (error) {
            console.warn("error: in level update", error);
            if(this.getCurRoom().stateMachine.curStateName === "death") this.getCurRoom().resetRoom();
        }
    }

    getCurRoom() {
        return this.curRoom
    }

    setCurRoom(r, spawnParams) {
        this.curRoom = r;
        this.curRoom.stateMachine.transitionTo("spawn", spawnParams);
    }

    collisionLayerSome(actor, forEachLayer) {
        let ret = null;
        actor.collisionLayers.some(layerName => {
            const curLayer = this.layers[layerName];
            if (curLayer) {
                const result = forEachLayer(curLayer);
                if (result) {
                    ret = result;
                    return true;
                }
            }
        });
        return ret ? ret : this.getCurRoom().collisionLayerSome(actor, forEachLayer);
    }

    checkCollide(physObj, offset) {
        const ret = this.collisionLayerSome(physObj, curLayer => {
            return curLayer.checkCollide(physObj, offset);
        });
        return ret;
    }

    getAllRidingActors(solid) {
        let ret = [];
        this.forEachActorLayer(layer => {
            layer.objs.forEach(actor => {
                if (actor.isRiding(solid)) {
                    ret.push(actor);
                }
            });
        });
        ret.concat(this.getCurRoom().getAllRidingActors(solid));
        return ret;
    }

    isOnGround(actor) {
        return this.collisionLayerSome(actor, curLayer => {
            let ret = null;
            curLayer.objs.some(solid => {
                const pC = solid.onPlayerCollide();
                if ((pC.includes("wall") || pC === "") && actor.isOnTopOf(solid)) {
                    ret = solid;
                    return true;
                }
            });
            return ret;
        });
    }

    isOnWallGrindable(actor) {
        return this.collisionLayerSome(actor, curLayer => {
            let ret = null;
            curLayer.objs.some(solid => {
                if (solid.isWallGrindable() && (actor.isLeftOf(solid) || solid.isLeftOf(actor))) {
                    ret = solid;
                    return true;
                }
            });
            return ret;
        });
    }

    isTouchingThrowable(physObj) {
        let ret = null;
        this.layers["throwables"].objs.some(t => {
            if (physObj.isTouching(t.getHitbox())) {
                ret = t;
                return;
            }
        });
        return ret;
    }

    inWhichRooms(physObj) {
        let ret = [];
        this.layers["rooms"].objs.forEach(room => {
            if (room.isOverlap(physObj, BMath.VectorZero)) ret.push(room);
        });
        return ret;
    }
}

class Room extends Phys.PhysObj {
    //entity["x"], entity["y"], entity["width"], entity["height"], level, spawnObjs, entity["id"]
    constructor(x, y, w, h, level, spawnObjs, id) {
        super(x, y, w, h, ["player"], level);
        this.id = id;
        this.layers = {
            "playerSpawns": new Phys.Layer(true),
            "throwableSpawns": new Phys.Layer(true),
            // "switchBlocks": new Phys.Layer(false),
        };
        console.log(spawnObjs);
        Object.keys(spawnObjs).forEach(spawnLayerName => {
            this.layers[spawnLayerName].objs = spawnObjs[spawnLayerName];
        });
        this.idleUpdate = this.idleUpdate.bind(this);
        this.resetRoom = this.resetRoom.bind(this);
        this.resetThrowables = this.resetThrowables.bind(this);
        this.stateMachine = new StateMachine({
            "load": {
                maxTimer: 16,
                onStart: () => this.resetThrowables,
                onUpdate: this.idleUpdate,
                timeOutTransition: "spawn",
                transitions: ["spawn", "idle"],
            },
            "spawn": {
                maxTimer: 5,
                onStart: this.resetRoom,
                onUpdate: () => {
                    console.log("resetting");
                },
                timeOutTransition: "idle",
                transitions: ["idle"]
            },
            "idle": {
                onStart: () => {
                    console.log("on idle start")
                },
                onUpdate: this.idleUpdate,
                transitions: ["death", "nextRoom"]
            },
            "death": {
                maxTimer: 10,
                onStart: (deathPos) => {
                    console.log("death start", deathPos)
                },
                onUpdate: () => {
                    // console.log("death update")
                },
                timeOutTransition: "spawn",
                transitions: ["idle", "spawn"],
            },
            "nextRoom": {
                timer: 15,
                onStart: this.nextRoom,
                onComplete: () => {
                    // console.log("next level complete")
                },
                timeOutTransition: "END"
            }
        });
    }

    onPlayerCollide() {
        return "room";
    }

    onCollide(actor) {
        console.log(actor);
        // if(actor.onPlayerCollide() === "") {
        //     this.getLevel().setCurrentRoom(this);
        // }
    }

    draw() {
        super.draw("#0000ff80");
    }

    drawAll() {
        if(Phys.DEBUG) this.forEachLayer(layer => {
            layer.drawAll();
        });
    }

    move(x, y) {
    }

    getSpawnLayerNames() {
        return Object.keys(this.layers).filter(layerName => layerName.includes("Spawn"));
    }

    update() {
        this.stateMachine.update();
    }

    nextRoom() {
    }

    idleUpdate() {
        try {
            if (this.stateMachine.curStateName === "idle" && this.level.getPlayer()) {
                const outOfBounds = this.checkPlayerOutOfBounds();
                if (outOfBounds) {
                    const p = this.getLevel().getPlayer();
                    const roomsPlayerIsIn = this.getLevel().inWhichRooms(p);
                    const nextRoom = roomsPlayerIsIn.find(room => room !== this);
                    if (nextRoom) {
                        this.getLevel().setCurRoom(nextRoom, {spawnPlayer: false});
                        this.stateMachine.transitionTo("nextRoom");
                    } else if (outOfBounds === BMath.VectorDown) {
                        this.stateMachine.transitionTo("death");
                    } else if (outOfBounds === BMath.VectorRight) {
                        p.setX(this.getX());
                    } else if (outOfBounds === BMath.VectorLeft) {
                        p.setX(this.getX()+this.getWidth()-p.getWidth());
                    } else if(outOfBounds === BMath.VectorUp) {
                        p.setY(this.getY());
                    }
                }
            }
            const playerCamPos = this.getLevel().getPlayer().getPos().addPoint(BMath.Vector({x: 24, y: 0}));
            Graphics.centerCamera(playerCamPos, {x: this.getX(), y: this.getY()}, {
                x: this.getX() + this.getWidth(),
                y: this.getY() + this.getHeight()
            });
        } catch (error) {
            console.warn("error: in room update", error);
            // this.killPlayer();
        }
    }

    checkPlayerFallDeath() {
        return this.getLevel().getPlayer().getY() > this.getY() + this.getHeight();
    }

    checkPlayerOutOfBounds() {
        const p = this.getLevel().getPlayer();
        if (p.getX() < this.getX()) return BMath.VectorLeft;
        else if (p.getY() < this.getY()) return BMath.VectorUp;
        else if (p.getX()+p.getWidth() > this.getX() + this.getWidth()) return BMath.VectorLeft;
        else if (p.getY() > this.getY() + this.getHeight()) return BMath.VectorDown;
        return null;
    }

    checkNextRoom() {
        if (this.getLevel().inWhichRooms(this.getLevel().getPlayer()).length > 1) {
            return true;
        }
    }

    getLayers() {
        return this.layers;
    }

    resetRoom(spawnParams) {
        if(!spawnParams) {spawnParams = {}; spawnParams["resetPlayer"] = true;}
        if(spawnParams["resetPlayer"]) this.resetPlayer();
        this.resetThrowables();
    }

    resetPlayer() {
        const l = this.getLevel();
        l.getGame().respawn();
        l.setPlayer(null);
        ["playerSpawns"].forEach(spawnLayerName => {
            if (spawnLayerName.includes("player")) {
                l.setPlayer(this.layers[spawnLayerName].objs[0].respawnClone());
            }
        });
    }

    resetThrowables() {
        const l = this.getLevel();
        l.getGame().respawn();
        l.setThrowables(null);
        this.getSpawnLayerNames().forEach(spawnLayerName => {
            if (spawnLayerName.includes("throwable")) {
                l.setThrowables(this.layers[spawnLayerName].objs.map(spawn => spawn.respawnClone()));
            }
        });
        const p = this.getLevel().getPlayer();
        if(p.getCarrying()[0]) l.setThrowables(l.getThrowables().concat(p.getCarrying()[0]));
    }

    killPlayer(x, y) {
        this.stateMachine.transitionTo("death", {x: x, y: y});
    }

    setKeys(keys) {
        if (this.stateMachine.curStateName !== "load") {
            this.getLevel().getPlayer().setKeys(keys);
        }
    }

    collisionLayerSome(actor, forEachLayer) {
        let ret = null;
        actor.collisionLayers.some(layerName => {
            const curLayer = this.layers[layerName];
            if (curLayer) {
                const result = forEachLayer(curLayer);
                if (result) {
                    ret = result;
                    return true;
                }
            }
        });
        return ret;
    }

    checkCollide(physObj, offset) {
        const ret = this.collisionLayerSome(physObj, layer => {
            const ret = layer.checkCollide(physObj, offset);
            console.log(ret);
            return ret;
        });
        console.log("rccc", ret);
        return ret;
    }

    forEachLayer(f) {
        Object.keys(this.layers).forEach(layerName => f(this.layers[layerName]));
    }

    forEachActorLayer(f) {
        f(null);
    }

    getAllRidingActors(solid) {
        let ret = [];
        this.forEachActorLayer(layer => {
            if (layer) {
                layer.objs.forEach(actor => {
                    if (actor.isRiding(solid)) {
                        ret.push(actor);
                    }
                });
            }
        });
        return ret;
    }
}

export {
    Level, Room
}
import * as BMath from "./bMath.js";
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

const LAYER_NAMES = {
    "ROOMS": "rooms",
    "WALLS": "walls",
    "STATIC_SPIKES": "staticSpikes",
    "PLAYER_SPAWNS": "playerSpawns",
    "THROWABLE_SPAWNS":"throwableSpawns",
    "PLAYER": "player",
    "THROWABLES": "throwables",
    "SPRINGS": "springs",
    "BOOSTERS": "boosters",
};

const LAYER_TYPES = {
    "SOLID": "solid",
    "ACTOR": "actor",
    "OTHER": "other",
};

Object.freeze(LAYER_NAMES);

let player = null;

const LAYER_TO_OBJ = {
    [LAYER_NAMES.ROOMS]: (entity, level) => new Room(entity["x"], entity["y"], entity["width"], entity["height"], level, entity["values"]["roomId"]),
    [LAYER_NAMES.WALLS]: (x, y, level, tileData, tileSize) => new Mechanics.Wall(x, y, tileSize, tileSize, level, tileData),
    [LAYER_NAMES.STATIC_SPIKES]: (x, y, level, tileData, tileSize) => new Mechanics.PlayerKill(x, y + tileSize / 2 + 2, tileSize, 2, level, tileData),
    [LAYER_NAMES.PLAYER_SPAWNS]: (entity, level, tileSize) => new Mechanics.PlayerSpawn(entity["x"], entity["y"] + tileSize / 2, tileSize, tileSize * 1.5, level, entity["id"]),
    [LAYER_NAMES.THROWABLE_SPAWNS]: (entity, level, tileSize) => new Mechanics.ThrowableSpawn(entity["x"], entity["y"], tileSize*1.5, tileSize*1.5, level, entity["id"]),
    [LAYER_NAMES.SPRINGS]: (entity, level, tileSize) => {
        const h = tileSize/8*2;
        const newPos = ogmoRotateRectToTileOrigin(entity["x"], entity["y"], h, tileSize, entity["rotation"]);
        return new Mechanics.Spring(newPos.x, newPos.y, tileSize, h, ogmoRotationToVec(entity["rotation"]), level);
    },
    [LAYER_NAMES.BOOSTERS]: (entity, level, tileSize) => {
        const h = tileSize * 2;
        const newPos = ogmoRotateRectToTileOrigin(entity["x"], entity["y"], h, h, entity["rotation"]);
        return new Mechanics.Booster(newPos.x, newPos.y, h, h, ogmoRotationToVec(entity["rotation"]), level);
    }
};

function getLayerDataByName(data, layerName) {
    return data["layers"].find(layerData => layerData["name"] === layerName)
}

class Level {
    constructor(data, game) {
        this.game = game;
        this.rooms = new Layer(false, LAYER_NAMES.ROOMS, LAYER_TYPES.OTHER);
        const roomLayerData = getLayerDataByName(data, "rooms");
        roomLayerData["entities"].forEach(roomEntity => {
            this.rooms.pushObj(LAYER_TO_OBJ[LAYER_NAMES.ROOMS](roomEntity, this));
        });

        this.rooms.objs = this.rooms.objs.sort((a, b) => a.id - b.id);

        data["layers"].forEach(layerData => {
            if(layerData["name"] !== LAYER_NAMES.ROOMS) {
                this.setLayerFromData(layerData);
            }
        });

        this.rooms.objs.forEach(room => room.sortObjs());

        this.curRoom = this.rooms.objs[0];
        this.curRoom.stateMachine.transitionTo("spawn");
    }

    getCollidables(physObj) {
        return this.getCurRoom().getCollidables(physObj);
    }

    getCollidableActors(physObj) {
        return this.getCurRoom().getCollidableActors(physObj);
    }

    getCollidableSolids(physObj) {
        return this.getCurRoom().getCollidableActorLayers(physObj);
    }


    getRidingActors(physObj) {return this.getCurRoom().getRidingActors(physObj);}

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

    getPlayer() {return this.getCurRoom().getPlayer();}

    drawAll() {
        // this.decorations.forEach(curItem => {curItem.draw();});
        if(Phys.DEBUG) this.curRoom.draw();
        this.rooms.objs.forEach(room  => {
            room.drawAll();
        });
    }

    setLayerFromData(layerData) {
        const layerName = layerData["name"];
        if (layerData) {
            const yLen = layerData["gridCellsY"];
            const xLen = layerData["gridCellsX"];
            const gridCellWidth = Graphics.TILE_SIZE;
            const layerObjs = layerData["data2D"];
            const entities = layerData["entities"];
            const dataCoords = layerData["dataCoords2D"];
            const pushRoom = (newObj) => {
                const room = this.inWhichRooms(newObj)[0];
                if(room) room.pushObj(layerName, newObj);
            };
            if (layerObjs) {
                for (let y = 0; y < yLen - 1; y++) {
                    for (let x = 0; x < xLen; x++) {
                        const gameSpaceX = x * gridCellWidth;
                        const gameSpaceY = y * gridCellWidth;
                        const tileCode = parseInt(layerObjs[y][x]);
                        if (tileCode === 0 || tileCode === -1) {
                        } else {
                            const newObj = LAYER_TO_OBJ[layerName](gameSpaceX, gameSpaceY, this, tileCode, gridCellWidth);
                            pushRoom(newObj);
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
                            pushRoom(newObj);
                        }
                    }
                }
            } else if (entities) {
                entities.forEach(entity => {
                    const newObj = LAYER_TO_OBJ[layerName](entity, this, gridCellWidth);
                    pushRoom(newObj);
                })
            }
        }
    }

    getThrowables() {return this.layers.getLayer(LAYER_NAMES.THROWABLES).objs}

    killPlayer(x, y) {
        this.getCurRoom().killPlayer(x, y);
        // audioCon.playSoundEffect(DEATH_SFX);
    }

    setKeys(keys) {
        this.getCurRoom().setKeys(keys);
    }

    update() {
        try {
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

    nextRoom(r) {
        this.curRoom = r;
        r.stateMachine.transitionTo("intoRoom");
    }

    isOnGround(actor) {
        let ret = null;
        return this.getCurRoom().isOnGround(actor);
    }
    collideOffset(physObj, offset) {return this.getCurRoom().collideOffset(physObj, offset);}

    checkCollideSolidsOffset(physObj, offset) {return this.getCurRoom().checkCollideSolidsOffset(physObj, offset);}

    isOnWallGrindable(actor, offset) {
        return this.getCurRoom().isOnWallGrindable(actor, offset);
    }

    isTouchingThrowable(physObj) {
        return this.getCurRoom().isTouchingThrowable(physObj);
    }

    inWhichRooms(physObj) {
        let ret = [];
        this.rooms.objs.forEach(room => {
            if (room.isOverlap(physObj, BMath.VectorZero)) ret.push(room);
        });
        return ret;
    }
}

class Room extends Phys.PhysObj {
    //entity["x"], entity["y"], entity["width"], entity["height"], level, spawnObjs, entity["id"]
    constructor(x, y, w, h, level, id) {
        super(x, y, w, h, ["player"], level);
        this.id = id;
        this.layers = new Layers({
            [LAYER_NAMES.ROOMS]: new Layer(false, LAYER_NAMES.ROOMS, LAYER_TYPES.OTHER),
            [LAYER_NAMES.PLAYER_SPAWNS]: new Layer(true, LAYER_NAMES.PLAYER_SPAWNS, LAYER_TYPES.OTHER),
            [LAYER_NAMES.THROWABLE_SPAWNS]: new Layer(true, LAYER_NAMES.THROWABLE_SPAWNS, LAYER_TYPES.OTHER),
            [LAYER_NAMES.WALLS]: new Layer(true, LAYER_NAMES.WALLS, LAYER_TYPES.SOLID),
            [LAYER_NAMES.THROWABLES]: new Layer(false, LAYER_NAMES.THROWABLES, LAYER_TYPES.ACTOR),
            [LAYER_NAMES.STATIC_SPIKES]: new Layer(true, LAYER_NAMES.STATIC_SPIKES, LAYER_TYPES.SOLID),
            [LAYER_NAMES.SPRINGS]: new Layer(false, LAYER_NAMES.SPRINGS, LAYER_TYPES.SOLID),
            [LAYER_NAMES.BOOSTERS]: new Layer(false, LAYER_NAMES.BOOSTERS, LAYER_TYPES.SOLID),
            [LAYER_NAMES.PLAYER]: new Layer(false, LAYER_NAMES.PLAYER, LAYER_TYPES.ACTOR),
        });
        this.idleUpdate = this.idleUpdate.bind(this);
        this.resetRoom = this.resetRoom.bind(this);
        this.resetThrowables = this.resetThrowables.bind(this);
        this.nextRoom = this.nextRoom.bind(this);
        this.finishNextRoom = this.finishNextRoom.bind(this);
        this.stateMachine = new StateMachine({
            "load": {
                onStart: () => {},
                onUpdate: this.idleUpdate,
                transitions: ["spawn", "intoRoom"],
            },
            "intoRoom": {
                maxTimer: 8,
                onStart: this.resetThrowables,
                onUpdate: this.idleUpdate,
                onComplete: this.finishNextRoom,
                timeOutTransition: "idle",
                transitions: ["idle"]
            }, "spawn": {
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
                maxTimer: 1,
                onStart: (deathPos) => {
                    console.log("death start", deathPos)
                },
                onUpdate: () => {
                    // console.log("death update")
                },
                timeOutTransition: "spawn",
                transitions: ["spawn"],
            },
            "nextRoom": {
                timer: 15,
                onStart: (data) => {this.nextRoom(data["newRoom"])},
                onUpdate: () => {},
                onComplete: () => {},
                timeOutTransition: "END"
            }
        });
    }

    pushObj(layerName, obj) {
        this.layers.getLayer(layerName).pushObj(obj);
    }

    finishNextRoom() {
        // this.getPlayer().setX(Math.max(this.getX(), this.getPlayer().getX()));
    }

    isOnWallGrindable(actor, distance) {
        let ret = null;
        const aL = actor.getHitbox().cloneOffset(BMath.Vector({x:-distance,y:0}));
        const aR = actor.getHitbox().cloneOffset(BMath.Vector({x:distance,y:0}));
        this.layers.getCollidableLayers(actor).some(curLayer => {
            curLayer.objs.some(solid => {
                if (solid.isWallGrindable()) {
                    const sH = solid.getHitbox();
                    if(aL.isOverlap(sH)) {
                        ret = -1;
                        return true;
                    } else if(sH.isOverlap(aR)) {
                        ret = 1;
                        return true;
                    }
                }
            });
        });
        return ret;
    }

    isOnGround(actor) {
        let ret = null;
        this.layers.getCollidableLayers(actor).some(layer => {
            layer.objs.some(physObj => {
                const pC = physObj.onPlayerCollide();
                if ((pC.includes("wall") || pC === "") && actor.isOnTopOf(physObj)) {
                    ret = physObj;
                    return true;
                }
            });
        });
        return ret;
    }

    onPlayerCollide() {
        return "room";
    }

    onCollide(actor) {
        // if(actor.onPlayerCollide() === "") {
        //     this.getLevel().setCurrentRoom(this);
        // }
    }

    draw() {
        super.draw("#0000ff80");
    }

    drawAll() {
        if(Phys.DEBUG) this.layers.getLayers().forEach(layer => {layer.drawAll();});
        else this.layers.getLayers().forEach(layer => {
            if(!layer.name.includes("Spawn"))layer.drawAll();
        });
    }

    getSpawnLayerNames() {
        return Object.keys(this.layers).filter(layerName => layerName.includes("Spawn"));
    }

    update() {
        this.stateMachine.update();
    }

    nextRoom(newRoom) {
        newRoom.setPlayer(this.getPlayer());
        this.getLevel().nextRoom(newRoom);
        this.setPlayer(null);
        this.setThrowables([]);
    }

    idleUpdate() {
        try {
            const playerCamPos = this.getLevel().getPlayer().getPos().addPoint(BMath.Vector({x: 24, y: 0}));
            Graphics.centerCamera(playerCamPos, {x: this.getX(), y: this.getY()}, {
                x: this.getX() + this.getWidth(),
                y: this.getY() + this.getHeight()
            });
            this.layers.forEachLayer(layer => layer.update());
            if (this.stateMachine.curStateName === "idle" && this.level.getPlayer()) {
                const outOfBounds = this.checkPlayerOutOfBounds();
                if (outOfBounds) {
                    const p = this.getLevel().getPlayer();
                    const roomsPlayerIsIn = this.getLevel().inWhichRooms(p);
                    const newRoom = roomsPlayerIsIn.find(room => room !== this);
                    if (newRoom) {
                        this.stateMachine.transitionTo("nextRoom", {"newRoom": newRoom});
                    } else if (outOfBounds === BMath.VectorDown) {
                        this.killPlayer(p.x, p.y);
                    } else if (outOfBounds === BMath.VectorRight) {
                        p.setX(this.getX()+this.getWidth()-p.getWidth());
                    } else if (outOfBounds === BMath.VectorLeft) {
                        p.setX(this.getX());
                    } else if(outOfBounds === BMath.VectorUp) {
                        p.setY(this.getY());
                    }
                }
            }
        } catch (error) {
            console.warn("error: in  room update", error);
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

    resetRoom(spawnParams) {
        if(!spawnParams) {spawnParams = {}; spawnParams["resetPlayer"] = true;}
        if(spawnParams["resetPlayer"]) {this.resetPlayer(); this.getLevel().getGame().respawn();}
        this.resetThrowables();
    }


    setPlayer(p) {
        this.layers.getLayer(LAYER_NAMES.PLAYER).objs = [p];
        player = p;
    }

    getPlayer() {
        const playerLayerObjs = this.layers.getLayer(LAYER_NAMES.PLAYER).objs;
        return playerLayerObjs && playerLayerObjs[0] ? playerLayerObjs[0] : null;
    }

    resetPlayer() {
        this.setPlayer(this.layers.getLayer(LAYER_NAMES.PLAYER_SPAWNS).objs[0].respawnClone());
    }

    getThrowables() {
        return this.layers.getLayer(LAYER_NAMES.THROWABLES).objs;
    }

    setThrowables(arr) {
        this.layers.getLayer(LAYER_NAMES.THROWABLES).objs= arr;
    }

    resetThrowables() {
        this.setThrowables(this.layers.getLayer(LAYER_NAMES.THROWABLE_SPAWNS).objs.map(spawn => spawn.respawnClone()));
        const p = this.getPlayer();
        if(p && p.thrower.picking) this.setThrowables(this.getThrowables().concat(p.thrower.picking));
        console.log(this.getThrowables());
    }

    killPlayer(x, y) {
        if(this === this.getLevel().getCurRoom()) this.stateMachine.transitionTo("death", {x: x, y: y});
    }

    setKeys(keys) {
        if (this.stateMachine.curStateName !== "load" && this.stateMachine.curStateName !== "intoRoom") {
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

    sortObjs() {
        this.layers.sortObjs();
    }

    collideOffset(physObj, offset) {
        return this.layers.collideOffset(physObj, offset);
    }

    getCollidables(physObj) {return this.layers.getCollidables(physObj);}

    getCollidableActorLayers(physObj) {return this.layers.getCollidableLayers(physObj);}

    getCollidableActors(physObj) {return this.layers.getCollidableActors(physObj);}

    getRidingActors(physObj) {return this.layers.getRidingActors(physObj);}

    checkCollideSolidsOffset(physObj, offset) {return this.layers.checkCollideSolidsOffset(physObj, offset);}

    isTouchingThrowable(physObj) {return this.layers.isTouchingThrowable(physObj);}
}

class Layers {
    constructor(layers, level) {
        this.layers = layers;
    }

    getLayer(name) {return this.layers[name];}

    getLayers() {
        return Object.keys(this.layers).map(layerName=> this.layers[layerName]);
    }

    forEachLayer(f) {
        Object.keys(this.layers).forEach(layerName => f(this.layers[layerName]));
    }

    sortObjs() {
        this.forEachLayer(layer => layer.sortObjs());
    }

    getRidingActors(physObj) {
        let ret = [];
        this.getCollidableActorLayers(physObj).forEach(layer => {
            if (layer) {
                layer.objs.forEach(actor => {
                    if (actor.isRiding(physObj)) {
                        ret.push(actor);
                    }
                });
            }
        });
        return ret;
    }

    getCollidableLayers(physObj) {return this.getLayers().filter(layer => physObj.collisionLayers.includes(layer.name))}

    /** Returns all static layers*/
    getStaticLayers() {
        return this.getLayers().filter(layer => layer.allStatic);
    }

    /** Returns all nonstatic layers*/
    getDynamicLayers() {
        return this.getLayers().filter(layer => !layer.allStatic);
    }

    getSolidLayers() {
        return this.getLayers().filter(layer => layer.layerType === LAYER_TYPES.SOLID);
    }

    getActorLayers() {
        return this.getLayers().filter(layer => layer.layerType === LAYER_TYPES.ACTOR);
    }

    getNonRoomLayers() {
        return this.getLayers().filter(layer => layer.name !== LAYER_NAMES.ROOMS);
    }

    getCollidables(physObj) {
        let ret = [];
        this.getCollidableLayers(physObj).forEach(layer => {
            // layer.forEachSlicedObjs(physObj.getX()-physObj.getWidth(), physObj.getX()+physObj.getWidth()*2, obj => ret = ret.concat(obj));
            layer.forEachSlicedObjs(physObj.getX(), physObj.getX()+physObj.getWidth(), obj => ret = ret.concat(obj));
        });
        return ret;
    }

    /** Returns all actor layers that [physObj] can collide with*/
    getCollidableActorLayers(physObj) {
        return this.getActorLayers().filter(actorLayer => physObj.collisionLayers.includes(actorLayer.name));
    }

    getCollidableActors(physObj) {
        let ret = [];
        this.getCollidableActorLayers(physObj).forEach(actorLayer => {
            ret = ret.concat(actorLayer.objs);
        });
        return ret;
    }

    getCollidableSolidLayers(physObj) {
        return this.getSolidLayers().filter(actorLayer => physObj.collisionLayers.includes(actorLayer.name));
    }

    checkCollideSolidsOffset(physObj, offset) {
        let ret = null;
        this.getCollidableSolidLayers(physObj).some(layer => {
            const r = layer.collideOffset(physObj, offset);
            if(r) {ret = r; return r;}
        });
        return ret;
    }

    collideOffset(physObj, offset) {
        let ret = null;
        this.getCollidableLayers(physObj).some(curLayer => {
            let r = curLayer.collideOffset(physObj, offset);
            if(r) {ret = r; return true;}
        });
        return ret;
    }

    isTouchingThrowable(physObj) {
        return this.getLayer(LAYER_NAMES.THROWABLES).isTouching(physObj);
    }
}

const physObjCompare = (a, b) => {
    return a.getX()+a.getWidth()-(b.getX()+b.getWidth());
};

class Layer {
    constructor(allStatic, name, layerType) {
        this.objs = [];
        this.allStatic = allStatic;
        this.name = name;
        this.layerType = layerType;
    }

    sortObjs() {
        this.objs.sort(physObjCompare);
    }

    pushObj(o) {
        this.objs.push(o);
    }

    forEachSlicedObjs(lowTarget, highTarget, callBack) {
        if(this.objs.length !== 0 && this.allStatic) {
            const lowInd = this.binaryAboveX(lowTarget);
            const len = this.objs.length;
            for(let i = lowInd; i<len; ++i) {
                const curObj = this.objs[i];
                if(curObj.getX()-curObj.getWidth() < highTarget) {
                    callBack(curObj);
                } else {
                    break;
                }
            }
        } else {
            this.objs.forEach(callBack);
        }
        // return this.allStatic ? this.objs.slice(this.binaryAboveX(lowInd), this.binaryBelowX(highInd)) : this.objs;
    }

    drawAll() {
        const leftWidth = Math.max(this.objs[0] ? this.objs[0].getWidth() : 0, Graphics.TILE_SIZE);
        /*this.forEachSlicedObjs(
            player.getX(),
            player.getX()+player.getWidth(),
            o => {
                o.draw();
            }
        );*/this.forEachSlicedObjs(
            -Graphics.cameraOffset.x-leftWidth,
            -Graphics.cameraOffset.x+Graphics.cameraSize.x,
            o => {
                if(o) o.draw();
            }
        );
    }

    update() {
        if(this.allStatic) {
            // console.warn("Warning: updating static layer");
            // console.trace();
            // throw new Error("Trying to update layer in static layer");
        } else {
            this.objs.forEach(o => {
                o.update();
            });
        }
    }

    collideOffset(physObj, offset) {
        let ret = null;
        this.forEachSlicedObjs(
            physObj.getX() + offset.x-Graphics.TILE_SIZE,
            physObj.getX() + physObj.getWidth() + offset.x+Graphics.TILE_SIZE,
            checkObj => {
                if (checkObj !== physObj && physObj.isOverlap(checkObj, offset)) {
                    ret = checkObj;
                    return checkObj;
                }
            }
        );
        return ret;
    }

    /*binaryAboveX(key) {
        let low = 0;
        let high = this.objs.length;
        while (low < high) {
            let mid = Math.floor((low + high) / 2);
            let midObj = this.objs[mid];
            if (midObj.getX()+midObj.getWidth() < key) {
                low = mid + 1;
            } else if (mid < 1 || this.objs[mid-1].getX()+this.objs[mid-1].getWidth() <= key) {
                // console.log(this.objs.map(ob => ob.getX()));
                return mid;
            } else  {
                low = mid + 1;
            }
        }
        return low;
    }*/

    binaryAboveX(targetX) {
        let low = 0, high = this.objs.length; // numElems is the size of the array i.e arr.size()
        while (low+1 < high) {
            const mid = Math.floor((low + high) / 2); // Or a fancy way to avoid int overflow
            const mO = this.objs[mid];
            if (mO.getX()+mO.getWidth() > targetX) {
                if(mid < 1 || this.objs[mid-1].getX()+this.objs[mid-1].getWidth() <= targetX) return mid-1;
                high = mid;
            }
            else {
                low = mid;
            }
        }
        if(low === 0) {return 0;}
        else return this.objs.length;
    }

    isTouching(physObj) {
        let ret = null;
        this.forEachSlicedObjs(physObj.getX(), physObj.getX()+physObj.getWidth(), checkObj => {
            if(physObj.isTouching(checkObj.getHitbox())) ret = checkObj;
        });
        return ret;
    }
}

export {
    Level, Room, Layer, LAYER_NAMES, LAYER_TYPES
}
import * as BMath from "./bMath.js";
import {Player} from "./player.js";
import {Throwable} from "./throwable.js";
import {StateMachine} from "./stateMachine.js";
import * as Graphics from "./graphics.js";
import * as Phys from './basePhysics.js';
import * as Mechanics from './mechanics.js';

const LAYER_TO_OBJ = {
    "rooms": (entity, spawnObjs, level) => new Room(entity["x"], entity["y"], entity["width"], entity["height"], level, spawnObjs, entity["id"]),
    "walls": (x, y, level, tileData, tileSize) => new Mechanics.Wall(x, y, tileSize, tileSize, level, tileData),
    "staticSpikes": (x, y, level, tileData, tileSize) => new Mechanics.PlayerKill(x, y + tileSize / 2 + 2, tileSize, 2, level, tileData),
    "playerSpawns": (entity, level, tileSize) => new Mechanics.PlayerSpawn(entity["x"], entity["y"]+tileSize/2, tileSize, tileSize*1.5, level, entity["id"], entity["values"]["roomId"]),
    "throwableSpawns": (entity, level, tileSize) => new Mechanics.ThrowableSpawn(entity["x"], entity["y"], tileSize, tileSize, level, entity["id"], entity["values"]["roomId"]),
    // "actors": (x, y, w, h, room, tileCode) => new Mechanics.PlayerKill(x, y, w, h, room, tileCode)
};

function getLayerDataByName(data, layerName) {return data["layers"].find(layerData => layerData["name"] === layerName)}

class Level {
    constructor(data, game) {
        this.game = game;
        this.layers = {
            "rooms": new Phys.Layer(false),
            "walls": new Phys.Layer(true),
            "staticSpikes": new Phys.Layer(true),
            "throwables": new Phys.Layer(false),
            "player": new Phys.Layer(false),
            // "switchBlocks": new Phys.Layer(false),
        };
        // convertWallTiles(tileArr);

        this.globalStaticLayerNames = ["walls", "staticSpikes"];
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

    getGame() {return this.game;}

    drawAll() {
        // this.decorations.forEach(curItem => {curItem.draw();});
        this.curRoom.draw();
        this.forEachLayerNotRooms(layer => layer.drawAll());
        this.curRoom.drawAll();
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

    setPlayer(p) {this.layers["player"].objs = [p];}
    getPlayer() {
        return this.layers["player"].objs && this.layers["player"].objs[0] ? this.layers["player"].objs[0] : null;
    }

    setThrowables(arr) {this.layers["throwables"].objs = arr;}

    killPlayer(x, y) {
        this.curRoom.killPlayer(x, y);
        this.game.death();
        // audioCon.playSoundEffect(DEATH_SFX);
    }

    setKeys(keys) {
        this.getCurRoom().setKeys(keys);
    }

    update() {
        this.forEachLayerNotRooms(layer => layer.update());
        this.getCurRoom().update();
    }

    getCurRoom() {return this.curRoom}

    collisionLayerSome(actor, forEachLayer) {
        let ret = null;
        actor.collisionLayers.some(layerName => {
            const curLayer = this.layers[layerName];
            if(curLayer) {
                const result = forEachLayer(curLayer);
                if(result) {ret = result; return true;}
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
                if(actor.isRiding(solid)) {
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
            if(physObj.isTouching(t.getHitbox())) {
                ret = t;
                return;
            }
        });
        return ret;
    }

    inWhichRooms(physObj) {
        let ret = [];
        this.layers["rooms"].objs.forEach(room => {
            if(room.isOverlap(physObj, BMath.VectorZero)) ret.push(room);
        });
        return ret;
    }
}

class aLevel {
    constructor(data, game) {
        this.game = game;
        this.layers = {
            "rooms": new Phys.Layer(false),
            "walls": new Phys.Layer(true),
            "staticSpikes": new Phys.Layer(true),
            "playerSpawns": new Phys.Layer(true),
            "throwableSpawns": new Phys.Layer(true),
            // "switchBlocks": new Phys.Layer(false),
            "actors": new Phys.Layer(false),
        };
        // convertWallTiles(tileArr);
        this.pixelWidth = data["width"];
        this.pixelHeight = data["height"]-Graphics.TILE_SIZE;

        data.layers.forEach(layer => {
            const layerName = layer["name"];
            const yLen = layer["gridCellsY"];
            const xLen = layer["gridCellsX"];
            const gridCellWidth = Graphics.TILE_SIZE;
            const layerObjs = layer["data2D"];
            const entities = layer["entities"];
            const dataCoords = layer["dataCoords2D"];
            if(layerObjs) {
                for (let y = 0; y < yLen-1; y++) {
                    for (let x = 0; x < xLen; x++) {
                        const gameSpaceX = x * gridCellWidth;
                        const gameSpaceY = y * gridCellWidth;
                        const tileCode = parseInt(layerObjs[y][x]);
                        if(tileCode === 0 || tileCode === -1) {
                        } else {
                            const newObj = LAYER_TO_OBJ[layerName](gameSpaceX, gameSpaceY, this, tileCode, gridCellWidth);
                            this.layers[layerName].pushObj(newObj);
                        }
                    }
                }
            } else if(dataCoords) {
                for (let y = 0; y < yLen-1; y++) {
                    for (let x = 0; x < xLen; x++) {
                        const gameSpaceX = x * gridCellWidth;
                        const gameSpaceY = y * gridCellWidth;
                        const tileArr = dataCoords[y][x];
                        if(tileArr[0] === -1 || (tileArr[0] === 0 && tileArr[0] === 0)) {
                        } else {
                            const newObj = LAYER_TO_OBJ[layerName](gameSpaceX, gameSpaceY, this, tileArr, gridCellWidth);
                            this.layers[layerName].pushObj(newObj);
                        }
                    }
                }
            } else if(entities) {
                entities.forEach(entity => {
                    const newObj = LAYER_TO_OBJ[layerName](entity, this, gridCellWidth);
                    this.layers[layerName].pushObj(newObj);
                })
            }
        });

        this.endLevelFrames = 0;
        this.opacity = 0;

        this.forEachLayer(layer => {
            layer.sortObjs();
        });
        this.layers["rooms"].objs.sort((a, b) => a.id-b.id);
        this.curRoom = this.layers["rooms"].objs.reduce((accum, curVal) => accum.id > curVal.id ? curVal : accum);
        this.player = null;
        this.getSpawnLayerNames().forEach(spawnLayerName => {
            this.layers[spawnLayerName].objs.forEach(spawnObj => {
                const roomId = spawnObj["roomId"];
                this.layers["rooms"].objs[roomId].addSpawn(spawnObj);
            });
        });

        this.idleUpdate = this.idleUpdate.bind(this);
        this.resetRoom = this.resetRoom.bind(this);
        this.stateMachine = new StateMachine({
            "spawn": {
                maxTimer: 5,
                onStart: this.resetRoom,
                onUpdate: () => {
                    // console.log("spawn update")
                    console.log("restting");
                },
                timeOutTransition: "idle",
                transitions: ["idle"]
            },
            "idle": {
                onStart: () => {
                    // console.log("on idle start")
                },
                onUpdate: this.idleUpdate,
                transitions: ["death", "nextRoom"]
            },
            "death": {
                maxTimer: 10,
                onStart: (deathPos) => {
                    // console.log("death start", deathPos)
                },
                onUpdate: () => {
                    // console.log("death update")
                },
                timeOutTransition: "spawn",
                transitions: ["idle", "spawn"],
            },
            "nextRoom": {
                timer: 15,
                onComplete: () => {
                    // console.log("next level complete")
                },
                timeOutTransition: "END"
            }
        });
    }

    getSpawnLayerNames() {return Object.keys(this.layers).filter(layerName => layerName.includes("Spawns"));}

    setCurrentRoom(room) {
        if(this.curRoom.id < room.id) {
            this.curRoom = room;
        }
    }

    drawAll() {
        // this.decorations.forEach(curItem => {curItem.draw();});
        Object.keys(this.layers).forEach(layerName => {
            const curLayer = this.layers[layerName];
            if(Phys.DEBUG) curLayer.drawAll();
            else {
                if(!layerName.includes("Spawns") && !layerName.includes("rooms")) {
                    curLayer.drawAll();
                }
            }
        });
    }
    endGame() {}
    pushDecoration(d) {this.decorations.push(d);}
    pushDustSprite(g) {
        this.dustSprites.push(g);
    }
    removeDecoration(d) {
        const index = this.decorations.findIndex(de => de.id === d.id);
        if (index > -1) {
          this.decorations.splice(index, 1);
        }
    }
    removeDustSprite(d) {
        const index = this.dustSprites.indexOf(d);
        if (index > -1) {
            this.dustSprites.splice(index, 1);
        }
    }
    update() {
        this.stateMachine.update();
    }
    idleUpdate() {
        // this.getAllGeometry().forEach(geom => {geom.update();});
        // this.decorations.forEach(decoration => {decoration.update();});
        // this.dustSprites.forEach(g => {g.update()});
        try {
            this.forEachLayer(layer => {layer.update();});
            if(this.stateMachine.curStateName === "idle" && this.player) {
                if (this.checkPlayerFallDeath() && !this.checkNextRoom()) {
                    this.stateMachine.transitionTo("death");
                    console.log("death");
                }
                if (this.checkNextRoom()) {
                    console.log("next room");
                    this.stateMachine.transitionTo("nextRoom");
                }
            }
            const playerPos = this.getPlayer().getPos().addPoint(BMath.Vector({x:24, y:0}));
            Graphics.centerCamera(playerPos, {x:this.curRoom.getX(), y:this.curRoom.getY()}, {x:this.curRoom.getX()+this.curRoom.getWidth(), y:this.curRoom.getY()+this.curRoom.getHeight()});
        } catch (error) {
            console.warn("error: in room udpate", error);
            // this.killPlayer();
        }
        // if(this.endLevelFrames === 1) {
        //     this.game.nextLevel();
        //     this.endLevelFrames = 0;
        // }
        // if(!this.faded && game.onStickyLevel() && game.getCurrentRoom() === this && this.player.getX() > 80) {
        //     this.faded = true;
        //     audioCon.fadeOutSong(750);
        // }
        // if(this.endLevelFrames > 1) {
        //     this.endLevelFrames -= 1;
        //     this.fade(1-this.endLevelFrames/32);
        // }
    }

    collisionLayerSome(actor, forEachLayer) {
        let ret = null;
        actor.collisionLayers.some(layerName => {
            const curLayer = this.layers[layerName];
            if(curLayer) {
                const result = forEachLayer(curLayer);
                if(result) {ret = result; return true;}
            }
        });
        return ret;
    }

    checkCollide(physObj, offset) {
        return this.collisionLayerSome(physObj, curLayer => {
            return curLayer.checkCollide(physObj, offset);
        });

        // let ret = null;
        // physObj.collisionLayers.some(layerName => {
        //     const c = this.layers[layerName].checkCollide(physObj, offset);
        //     if(c) {
        //         ret = c;
        //         return c;
        //     }
        // });
        // return ret;
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
        //
        // let ret = null;
        // actor.collisionLayers.some(layerName => {
        //     if(this.layers[layerName]) {
        //         this.layers[layerName].objs.forEach(solid => {
        //             const pC = solid.onPlayerCollide();
        //             if((pC.includes("wall") || pC === "") && actor.isOnTopOf(solid)) {
        //                 ret = solid;
        //                 return true;
        //             }
        //         })
        //     }
        // });
        // return ret;
    }

    isOnWallGrindable(actor) {
        return this.collisionLayerSome(actor, curLayer => {
            let ret = null;
            curLayer.objs.some(solid => {
                if(solid.isWallGrindable() && (actor.isLeftOf(solid) || solid.isLeftOf(actor))) {
                    ret = solid;
                    return true;
                }
            });
            return ret;
        });

        // let ret = null;
        // actor.collisionLayers.some(layerName => {
        //     this.layers[layerName].forEachSlicedObjs(actor.getX()-Graphics.TILE_SIZE, actor.getX()+actor.getWidth()+TILE_SIZE, obj => {
        //         if(obj.isWallGrindable() && (actor.isLeftOf(obj) || obj.isLeftOf(actor))) {
        //             ret = obj;
        //             return true;
        //         }
        //     });
        // });
        // return ret;
    }

    getAllRidingActors(solid) {
        let ret = [];
        this.layers["actors"].objs.forEach(actor => {
            if(actor.isRiding(solid)) {
                ret.push(actor);
            }
        });
        return ret;
    }

    resetRoom() {
        this.game.respawn();
        console.trace();
        this.layers["actors"].objs = this.curRoom.getRespawnActors();
        //If it's the first time starting the room, populate this.actors with new actors for every spawn layer. For the player, set the spawn point to the spawn with the first id.
        // if(this.layers["actors"].objs.length === 0) {
        //     const firstPlayerSpawn = this.layers["playerSpawns"].objs.reduce((min, current) => {
        //         if(min.getId() > current.getId()) return current;
        //         else return min;
        //     });
        //
        //     this.player = new Player(firstPlayerSpawn.getX(), firstPlayerSpawn.getY(), Graphics.TILE_SIZE, Graphics.TILE_SIZE*1.5, this);
        //     this.layers["actors"].pushObj(this.player);
        //
        //     this.layers["throwableSpawns"].objs.map(spawn => {
        //         const newThrowable = new Throwable(spawn.getX(), spawn.getY(), Graphics.TILE_SIZE, Graphics.TILE_SIZE, this);
        //         this.throwables.push(newThrowable);
        //         this.layers["actors"].pushObj(newThrowable);
        //     });
        // }
        // this.layers["actors"].objs = this.layers["actors"].objs.map(actor => {
        //     const newActor = actor.respawnClone(this);
        //     if(actor.onPlayerCollide() === "") {
        //         this.player = newActor;
        //     }
        //     else if(actor.onPlayerCollide().includes("throwable")) {this.throwables.push(newActor);}
        //     return newActor;
        // });
        console.log(this.layers["actors"].objs);
    }

    killPlayer(x, y) {
        this.stateMachine.transitionTo("death", {x:x, y:y});
        this.game.death();
        // audioCon.playSoundEffect(DEATH_SFX);
    }

    setKeys(keys) {
        if(this.player) this.player.setKeys(keys);
        if(this.layers["switchBlocks"]) this.layers["switchBlocks"].objs.forEach(blk => {blk.setKeys(keys);});
    }

    isTouchingThrowable(physObj) {
        return this.curRoom.isTouchingThrowable(physObj);
    }
    getActors() {return this.layers["actors"].objs;}
    // getDecorations() {return this.decorations;}
    setPlayer(p) {this.layers["player"].objs = [p];}
    getPlayer() {return this.layers["player"].objs[0];}
    getGame() {return this.game;}

    acheckNextRoom() {
        return false;
        // console.log(this.pixelWidth);
        // return this.player.getX() <= 0 || this.player.getX() + this.player.getWidth() >= this.pixelWidth;
    }

    checkPlayerFallDeath() {
        return this.curRoom.checkPlayerFallDeath();
    }
}

class Room extends Phys.PhysObj {
    //entity["x"], entity["y"], entity["width"], entity["height"], level, spawnObjs, entity["id"]
    constructor(x, y, w, h, level, spawnObjs, id) {
        super(x, y, w, h, ["actors"], level);
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
        this.stateMachine = new StateMachine({
            "load": {
                maxTimer: 16,
                onStart: () => {},
                onUpdate: this.idleUpdate,
                timeOutTransition: "spawn",
                transitions: ["spawn"],
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
        // if(actor.onPlayerCollide() === "") {
        //     this.getLevel().setCurrentRoom(this);
        // }
    }

    draw() {super.draw("#0000ff80");}

    drawAll() {
        this.forEachLayer(layer => {
            layer.drawAll();
        });
    }

    move(x, y) {}

    getSpawnLayerNames() {
        return Object.keys(this.layers).filter(layerName => layerName.includes("Spawn"));
    }

    update() {
        this.stateMachine.update();
    }

    nextRoom() {this.stateMachine.transitionTo("nextRoom");}

    idleUpdate() {
        try {
            if(this.stateMachine.curStateName === "idle" && this.level.getPlayer()) {
                if (this.checkPlayerFallDeath() && !this.checkNextRoom()) {
                    this.stateMachine.transitionTo("death");
                    console.log("fall death");
                }
                if (this.checkNextRoom()) {
                    // console.log("next room");
                }
            }
            const playerCamPos = this.getLevel().getPlayer().getPos().addPoint(BMath.Vector({x:24, y:0}));
            Graphics.centerCamera(playerCamPos, {x:this.getX(), y:this.getY()}, {x:this.getX()+this.getWidth(), y:this.getY()+this.getHeight()});
        } catch (error) {
            console.warn("error: in room udpate", error);
            // this.killPlayer();
        }
    }

    checkPlayerFallDeath() {
        return this.getLevel().getPlayer().getY() > this.getY()+this.getHeight();
    }

    checkNextRoom() {
        console.log(this.getLevel().inWhichRooms(this.getLevel().getPlayer()));
        if(this.getLevel().inWhichRooms(this.getLevel().getPlayer()).length > 1) {
            return true;
        }
    }

    getLayers() {return this.layers;}

    resetRoom() {
        const l = this.getLevel();
        l.getGame().respawn();
        l.setPlayer(null);
        l.setThrowables(null);
        this.getSpawnLayerNames().forEach(spawnLayerName => {
            if(spawnLayerName.includes("throwable")) {
                l.setThrowables(this.layers[spawnLayerName].objs.map(spawn => spawn.respawnClone()));
            } else if(spawnLayerName.includes("player")) {
                l.setPlayer(this.layers[spawnLayerName].objs[0].respawnClone());
            }
        });
    }

    killPlayer(x, y) {
        this.stateMachine.transitionTo("death", {x:x, y:y});
    }

    setKeys(keys) {
        if(this.stateMachine.curStateName !== "load") {
            this.getLevel().getPlayer().setKeys(keys);
        }
    }

    collisionLayerSome(actor, forEachLayer) {
        let ret = null;
        actor.collisionLayers.some(layerName => {
            const curLayer = this.layers[layerName];
            if(curLayer) {
                const result = forEachLayer(curLayer);
                if(result) {ret = result; return true;}
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

    forEachLayer(f) {Object.keys(this.layers).forEach(layerName => f(this.layers[layerName]));}

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
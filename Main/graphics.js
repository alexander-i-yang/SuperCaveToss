import * as BMath from './bMath.js';

const PIXEL_LETTERS = {
    'A': [
        [, 1],
        [1, , 1],
        [1, , 1],
        [1, 1, 1],
        [1, , 1]
    ],
    'B': [
        [1, 1],
        [1, , 1],
        [1, 1, 1],
        [1, , 1],
        [1, 1]
    ],
    'C': [
        [1, 1, 1],
        [1],
        [1],
        [1],
        [1, 1, 1]
    ],
    'D': [
        [1, 1],
        [1, , 1],
        [1, , 1],
        [1, , 1],
        [1, 1]
    ],
    'E': [
        [1, 1, 1],
        [1],
        [1, 1, 1],
        [1],
        [1, 1, 1]
    ],
    'F': [
        [1, 1, 1],
        [1],
        [1, 1],
        [1],
        [1]
    ],
    'G': [
        [, 1, 1],
        [1],
        [1, , 1, 1],
        [1, , , 1],
        [, 1, 1]
    ],
    'H': [
        [1, , 1],
        [1, , 1],
        [1, 1, 1],
        [1, , 1],
        [1, , 1]
    ],
    'I': [
        [1, 1, 1],
        [, 1],
        [, 1],
        [, 1],
        [1, 1, 1]
    ],
    'J': [
        [1, 1, 1],
        [, , 1],
        [, , 1],
        [1, , 1],
        [1, 1, 1]
    ],
    'K': [
        [1, , , 1],
        [1, , 1],
        [1, 1],
        [1, , 1],
        [1, , , 1]
    ],
    'L': [
        [1],
        [1],
        [1],
        [1],
        [1, 1, 1]
    ],
    'M': [
        [1, 1, 1, 1, 1],
        [1, , 1, , 1],
        [1, , 1, , 1],
        [1, , , , 1],
        [1, , , , 1]
    ],
    'N': [
        [1, , , 1],
        [1, 1, , 1],
        [1, , 1, 1],
        [1, , , 1],
        [1, , , 1]
    ],
    'O': [
        [1, 1, 1],
        [1, , 1],
        [1, , 1],
        [1, , 1],
        [1, 1, 1]
    ],
    'P': [
        [1, 1, 1],
        [1, , 1],
        [1, 1, 1],
        [1],
        [1]
    ],
    'Q': [
        [0, 1, 1],
        [1, , , 1],
        [1, , , 1],
        [1, , 1, 1],
        [1, 1, 1, 1]
    ],
    'R': [
        [1, 1],
        [1, , 1],
        [1, , 1],
        [1, 1],
        [1, , 1]
    ],
    'S': [
        [, 1, 1],
        [1],
        [1, 1, 1],
        [, , 1],
        [1, 1, ]
    ],
    'T': [
        [1, 1, 1],
        [, 1],
        [, 1],
        [, 1],
        [, 1]
    ],
    'U': [
        [1, , 1],
        [1, , 1],
        [1, , 1],
        [1, , 1],
        [1, 1, 1]
    ],
    'V': [
        [1, , , , 1],
        [1, , , , 1],
        [, 1, , 1],
        [, 1, , 1],
        [, , 1]
    ],
    'W': [
        [1, , , , 1],
        [1, , , , 1],
        [1, , , , 1],
        [1, , 1, , 1],
        [1, 1, 1, 1, 1]
    ],
    'X': [
        [1, , 1],
        [1, , 1],
        [, 1, ],
        [1, , 1],
        [1, , 1]
    ],
    'Y': [
        [1, , 1],
        [1, , 1],
        [, 1],
        [, 1],
        [, 1]
    ],
    'Z': [
        [1, 1, 1, 1, 1],
        [, , , 1],
        [, , 1],
        [, 1],
        [1, 1, 1, 1, 1]
    ],
    '0': [
        [1, 1, 1],
        [1, , 1],
        [1, , 1],
        [1, , 1],
        [1, 1, 1]
    ],
    '1': [
        [,1],
        [1, 1],
        [, 1],
        [, 1],
        [1, 1,1]
    ],
    '2': [
        [, 1, ],
        [1, , 1],
        [, , 1],
        [, 1, ],
        [1, 1, 1]
    ],
    '3': [
        [1, 1, 1],
        [, , 1],
        [1, 1, 1],
        [, , 1],
        [1, 1, 1]
    ],
    '4': [
        [1, , 1],
        [1, , 1],
        [1, 1, 1],
        [, , 1],
        [, , 1]
    ],
    '5': [
        [1, 1, 1],
        [1, , ],
        [1, 1, ],
        [, , 1],
        [1, 1, ]
    ],
    '6': [
        [1, 1, 1],
        [1, , ],
        [1, 1, 1],
        [1, , 1],
        [1, 1, 1]
    ],
    '7': [
        [1, 1, 1],
        [, , 1],
        [, , 1],
        [, , 1],
        [, , 1]
    ],
    '8': [
        [1, 1, 1],
        [1, , 1],
        [1, 1, 1],
        [1, , 1],
        [1, 1, 1]
    ],
    '9': [
        [1, 1, 1],
        [1, , 1],
        [1, 1, 1],
        [, , 1],
        [1, 1, 1]
    ],
    ' ': [
        [, ,],
        [, ,],
        [, ,],
        [, ,],
        [, ,]
    ],
    ':': [
        [, ,],
        [1, ,],
        [, ,],
        [1, ,],
        [, ,]
    ],
    '.': [
        [, ,],
        [, ,],
        [, ,],
        [, ,],
        [1, ,]
    ],
    '!': [
        [, 1,],
        [, 1,],
        [, 1,],
        [, ,],
        [, 1,]
    ], '-': [
        [, ,],
        [, ,],
        [1, 1,1],
        [, ,],
        [, ,]
    ],
    '(': [
        [,1,],
        [1, ,],
        [1, ,],
        [1, ,],
        [, 1,]
    ],
    ')': [
        [,1,],
        [, ,1],
        [, ,1],
        [, ,1],
        [, 1,]
    ],
    '+': [
        [,,],
        [, 1,],
        [1, 1,1],
        [, 1,],
        [, ,]
    ],
    '/': [
        [,,1],
        [,,1],
        [, 1,],
        [, 1,],
        [1, ,],
        [1, ,]
    ],
    '<': [
        [,,1],
        [,1,],
        [1, ,],
        [, 1,],
        [, ,1],
        [, ,]
    ],
    '>': [
        [1,,],
        [,1,],
        [,,1],
        [,1,],
        [1,,],
        [,,]
    ],
};
const TILE_SIZE = 8;
const CANVAS_SCALAR = 4;
const CANVAS = document.createElement("canvas");
const MAX_CAMERA_SPEED = 16;
const CAMERA_STICK_DISTANCE = 20;
const CAMERA_DELAY = TILE_SIZE*3;

document.body.insertBefore(CANVAS, document.body.childNodes[0]);

let animFrame = 0;

function setupCanvas(canvas) {
  // Get the device pixel ratio, falling back to 1.
  const dpr = (window.devicePixelRatio || 1)/CANVAS_SCALAR;
  // Get the size of the canvas in CSS pixels.
  const rect = canvas.getBoundingClientRect();
  // Give the canvas pixel dimensions of their CSS
  // size * the device pixel ratio.
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  // Scale all drawing operations by the dpr, so you
  // don't have to worry about the difference.
  ctx.scale(dpr, dpr);
  return ctx;
}
const CTX = setupCanvas(CANVAS);
const CANVAS_SIZE = [CANVAS.width, CANVAS.height];

let cameraOffset = BMath.Vector({x:0, y:0});
let fCameraOffset = BMath.Vector({x:0, y:0});
let cameraVelocity = BMath.Vector({x:0,y:0});
let cameraAcc = BMath.Vector({x:0,y:0});
let prevCameraD2X = 0;
let cameraSize = BMath.Vector({x:CANVAS_SIZE[0],y:CANVAS_SIZE[1]});

const applyCameraSmooth = (val) => {
        if(Math.abs(val) < 0.1) val = 0;
        let sub = val*0.15;
        if(Math.abs(sub) > CAMERA_DELAY) sub = val*0.2;
        if(Math.abs(sub) > MAX_CAMERA_SPEED) sub = Math.sign(sub)*MAX_CAMERA_SPEED;
        return sub;
    };

function centerCamera(pos, minBound, maxBound) {
    let newCenterX = -pos.x+CANVAS_SIZE[0]/2;
    let newCenterY = -pos.y+CANVAS_SIZE[1]/2;
    if(newCenterX > -minBound.x) newCenterX = -minBound.x;
    else if(-(newCenterX-CANVAS_SIZE[0]) > maxBound.x) newCenterX = -(maxBound.x-CANVAS_SIZE[0]);

    if(newCenterY > minBound.y) newCenterY = minBound.y;
    else if(-newCenterY+CANVAS_SIZE[1] > maxBound.y) newCenterY = -maxBound.y+CANVAS_SIZE[1];

    let d2x = fCameraOffset.x - newCenterX;
    let d2y = fCameraOffset.y - newCenterY;
    fCameraOffset.x -= applyCameraSmooth(d2x);
    fCameraOffset.y -= applyCameraSmooth(d2y);
    cameraOffset.x = Math.round(fCameraOffset.x);
    cameraOffset.y = Math.round(fCameraOffset.y);


    // let acc = 0;
    // if(Math.abs(d2x) > 10) {
    //     const sc = Math.sign(d2x);
    //     if(Math.abs(prevCameraD2X) > Math.abs(d2x)) {
    //         acc = CAMERA_ACCEL*sc;
    //     } else {
    //         acc = -CAMERA_ACCEL*sc;
    //     }
    // }
    // cameraVelocity.x += acc;
    // if(Math.abs(cameraVelocity.x) > MAX_CAMERA_SPEED) {cameraVelocity.x = Math.sign(cameraVelocity.x) * MAX_CAMERA_SPEED;}
    // cameraOffset.x += Math.round(cameraVelocity.x);
    // const newD2xSign = Math.sign(cameraOffset.x - newCenterX);
    // if(Math.sign(d2x) !== newD2xSign) {cameraOffset.x = newCenterX; cameraVelocity.x = 0;}
    // console.log(prevCameraD2X, d2x, cameraVelocity.x, acc);
    prevCameraD2X = d2x;
}

function drawRectOnCanvas(rect, color, notCameraOffset) {
    CTX.fillStyle = color ? color : "#29ADFF";
    const p = notCameraOffset ? rect.pos : rect.pos.addPoint(cameraOffset);
    CTX.fillRect(p.x, p.y, rect.width, rect.height);
}

function writeText(txt, size, pos, color, spacing, notCameraOffset) {
    let needed = [];
    txt = txt.toUpperCase(); // because I only did uppercase letters
    for (let i = 0; i < txt.length; i++) {
        const letter = PIXEL_LETTERS[txt.charAt(i)];
        if (letter) { // because there's letters I didn't do
            needed.push(letter);
        }
    }
    spacing = spacing ? spacing : 0;
    CTX.fillStyle = color ? color : 'black';
    let currX = pos.x;
    // size = Math.round((CANVAS_SCALAR*-0.5+3)*size);
    for (let i = 0; i < needed.length; i++) {
        const letter = needed[i];
        let currY = pos.y;
        let addX = 0;
        for (let y = 0; y < letter.length; y++) {
            let row = letter[y];
            for (let x = 0; x < row.length; x++) {
                if (row[x]) {
                    const writeX = currX + x * size + (notCameraOffset ? 0 : cameraOffset.x);
                    const writeY = currY+ (notCameraOffset ? 0 : cameraOffset.y);
                    CTX.fillRect(writeX, writeY, size, size);
                }
            }
            addX = Math.max(addX, row.length * size);
            currY += size;
        }
        currX += size + addX+spacing;
    }
}

function drawEllipseOnCanvas(x, y, rad, color, notCameraOffset) {
    CTX.fillStyle = color ? color : "#ffffff";
    CTX.beginPath();
    let p = BMath.Vector({x:x, y:y});
    if(!notCameraOffset) p.incrPoint(cameraOffset);
    CTX.ellipse(p.x, p.y, rad, rad, 0, 0, Math.PI*2, true);
    CTX.fill();
}

function clearCanvas() {CANVAS.width = CANVAS.width;}

function update() {
    clearCanvas();
    animFrame = (animFrame + 1)%60;
}

const toggleFullscreen = (event) => {
   const fullScreen = document.fullscreenElement;
   if(fullScreen) {
        document.exitFullscreen();
   } else {
        document.documentElement.requestFullscreen();
   }
};

document.addEventListener('fullscreenchange', (event) => {
    let scalar = CANVAS_SCALAR;
    let displayStyle = "block";
    if (document.fullscreenElement) {
        const screenHeight = screen.height;
        const screenWidth = screen.width;
        // scalar = Math.min(Math.floor(screenWidth/CANVAS_SIZE[0]), Math.floor(screenHeight/CANVAS_SIZE[1]));
        scalar = Math.min(screenWidth/CANVAS_SIZE[0], screenHeight/CANVAS_SIZE[1]);
        displayStyle = "flex";
    }
    const w = scalar*CANVAS_SIZE[0] + "px";
    const h = scalar*CANVAS_SIZE[1] + "px";
    CANVAS.style.width = w;
    CANVAS.style.height = h;
    CANVAS.style.backgroundSize = w + " " + h;
    document.getElementById("body").style.display = displayStyle;
});

CANVAS.ondblclick = () => {
    toggleFullscreen();
};

export {
    CANVAS, CTX, CANVAS_SIZE, CANVAS_SCALAR, update,
    TILE_SIZE, animFrame,
    cameraOffset, cameraSize, centerCamera,
    drawRectOnCanvas, drawEllipseOnCanvas,
    writeText,
}
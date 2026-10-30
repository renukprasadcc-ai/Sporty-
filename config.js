/* ---------------------------------------------------------------------
   Sporty — static configuration: landmark indices, angle math helpers,
   exercise definitions, guided-flow definitions, and 3D-view constants.
   No mutable app state lives here — this file is pure data + pure
   functions, safe to import anywhere without side effects.
--------------------------------------------------------------------- */

const L = { // MediaPipe Pose landmark indices we use
  L_SHOULDER:11, R_SHOULDER:12, L_ELBOW:13, R_ELBOW:14, L_WRIST:15, R_WRIST:16,
  L_HIP:23, R_HIP:24, L_KNEE:25, R_KNEE:26, L_ANKLE:27, R_ANKLE:28
};

function angleAt(a,b,c){
  const v1 = {x:a.x-b.x, y:a.y-b.y};
  const v2 = {x:c.x-b.x, y:c.y-b.y};
  const dot = v1.x*v2.x + v1.y*v2.y;
  const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
  let cos = dot / (m1*m2 + 1e-6);
  cos = Math.max(-1, Math.min(1, cos));
  return Math.acos(cos) * 180 / Math.PI;
}
function avgAngle(lm, a1,b1,c1, a2,b2,c2){
  const left = (lm[a1].visibility>0.4 && lm[b1].visibility>0.4 && lm[c1].visibility>0.4) ? angleAt(lm[a1],lm[b1],lm[c1]) : null;
  const right = (lm[a2].visibility>0.4 && lm[b2].visibility>0.4 && lm[c2].visibility>0.4) ? angleAt(lm[a2],lm[b2],lm[c2]) : null;
  if(left!=null && right!=null) return (left+right)/2;
  return left!=null ? left : right;
}
function singleAngle(lm, a,b,c){
  if(lm[a].visibility>0.4 && lm[b].visibility>0.4 && lm[c].visibility>0.4) return angleAt(lm[a],lm[b],lm[c]);
  return null;
}

const EXERCISES = {
  squat: {
    label:'Squat', unit:'reps', category:'exercise',
    joints:['L_HIP','L_KNEE','L_ANKLE','R_HIP','R_KNEE','R_ANKLE'],
    angleOf(lm){ return avgAngle(lm, L.L_HIP,L.L_KNEE,L.L_ANKLE, L.R_HIP,L.R_KNEE,L.R_ANKLE); },
    sym:{ left:[L.L_HIP,L.L_KNEE,L.L_ANKLE], right:[L.R_HIP,L.R_KNEE,L.R_ANKLE] },
    lowThresh:100, highThresh:160, // low = bottom of squat, high = standing
    lowMsg:'Depth is good — drive through your heels.',
    highMsg:'Stand tall to lock out the rep.',
    formCheck(lm, angle){
      const kneeX = (lm[L.L_KNEE].x + lm[L.R_KNEE].x)/2;
      const ankleX = (lm[L.L_ANKLE].x + lm[L.R_ANKLE].x)/2;
      if(angle < 130 && Math.abs(kneeX-ankleX) > 0.12){
        return {warn:true, text:'Knees drifting past your toes — sit back into your heels.', joints:[L.L_KNEE,L.R_KNEE,L.L_ANKLE,L.R_ANKLE]};
      }
      return null;
    }
  },
  pushup: {
    label:'Push-up', unit:'reps', category:'exercise',
    joints:['L_SHOULDER','L_ELBOW','L_WRIST','R_SHOULDER','R_ELBOW','R_WRIST'],
    angleOf(lm){ return avgAngle(lm, L.L_SHOULDER,L.L_ELBOW,L.L_WRIST, L.R_SHOULDER,L.R_ELBOW,L.R_WRIST); },
    sym:{ left:[L.L_SHOULDER,L.L_ELBOW,L.L_WRIST], right:[L.R_SHOULDER,L.R_ELBOW,L.R_WRIST] },
    lowThresh:95, highThresh:155,
    lowMsg:'Chest low — good depth.',
    highMsg:'Arms extended — lock out at the top.',
    formCheck(lm, angle){
      const hipY = (lm[L.L_HIP].y + lm[L.R_HIP].y)/2;
      const shoulderY = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y)/2;
      const ankleY = (lm[L.L_ANKLE].y + lm[L.R_ANKLE].y)/2;
      const expected = (shoulderY+ankleY)/2;
      if(Math.abs(hipY-expected) > 0.09){
        return {warn:true, text: hipY < expected ? 'Hips are piking up — brace your core.' : 'Hips are sagging — squeeze glutes and core.', joints:[L.L_HIP,L.R_HIP]};
      }
      return null;
    }
  },
  curl: {
    label:'Bicep curl', unit:'reps', category:'exercise',
    joints:['L_SHOULDER','L_ELBOW','L_WRIST','R_SHOULDER','R_ELBOW','R_WRIST'],
    angleOf(lm){ return avgAngle(lm, L.L_SHOULDER,L.L_ELBOW,L.L_WRIST, L.R_SHOULDER,L.R_ELBOW,L.R_WRIST); },
    sym:{ left:[L.L_SHOULDER,L.L_ELBOW,L.L_WRIST], right:[L.R_SHOULDER,L.R_ELBOW,L.R_WRIST] },
    lowThresh:55, highThresh:155, // low = curled, high = extended
    lowMsg:'Full contraction — nice squeeze.',
    highMsg:'Fully extended — control the negative.',
    formCheck(lm, angle){
      const lShX = lm[L.L_SHOULDER].x, lElX = lm[L.L_ELBOW].x;
      if(Math.abs(lShX-lElX) > 0.10){
        return {warn:true, text:'Elbow is swinging away from your torso — pin it to your side.', joints:[L.L_ELBOW,L.L_SHOULDER]};
      }
      return null;
    }
  },
  plank: {
    label:'Plank', unit:'sec held', category:'exercise',
    hold:true,
    joints:['L_SHOULDER','L_HIP','L_ANKLE','R_SHOULDER','R_HIP','R_ANKLE'],
    angleOf(lm){ return avgAngle(lm, L.L_SHOULDER,L.L_HIP,L.L_ANKLE, L.R_SHOULDER,L.R_HIP,L.R_ANKLE); },
    sym:{ left:[L.L_SHOULDER,L.L_HIP,L.L_ANKLE], right:[L.R_SHOULDER,L.R_HIP,L.R_ANKLE] },
    holdMin:158, holdMax:185,
    formCheck(lm, angle){
      if(angle < 158) return {warn:true, text:'Hips sagging below line — lift and brace your core.', joints:[L.L_HIP,L.R_HIP]};
      return null;
    }
  },
  lunge: {
    label:'Lunge', unit:'reps', category:'exercise',
    joints:['L_HIP','L_KNEE','L_ANKLE'],
    angleOf(lm){ return singleAngle(lm, L.L_HIP, L.L_KNEE, L.L_ANKLE); },
    lowThresh:100, highThresh:165, // low = bottom of lunge (front leg), high = standing
    lowMsg:'Good depth on the front knee.',
    highMsg:'Stand back up to reset.',
    formCheck(lm, angle){
      const kneeX = lm[L.L_KNEE].x, ankleX = lm[L.L_ANKLE].x;
      if(angle < 130 && Math.abs(kneeX-ankleX) > 0.13){
        return {warn:true, text:'Front knee is drifting past your toes — shift weight toward your heel.', joints:[L.L_KNEE,L.L_ANKLE]};
      }
      return null;
    }
  },
  overhead: {
    label:'Overhead press', unit:'reps', category:'exercise',
    joints:['L_HIP','L_SHOULDER','L_WRIST','R_HIP','R_SHOULDER','R_WRIST'],
    angleOf(lm){ return avgAngle(lm, L.L_HIP,L.L_SHOULDER,L.L_WRIST, L.R_HIP,L.R_SHOULDER,L.R_WRIST); },
    sym:{ left:[L.L_HIP,L.L_SHOULDER,L.L_WRIST], right:[L.R_HIP,L.R_SHOULDER,L.R_WRIST] },
    lowThresh:45, highThresh:150, // low = arms at sides, high = pressed overhead
    lowMsg:'Arms at the bottom — good reset.',
    highMsg:'Locked out overhead.',
    formCheck(lm, angle){
      const shoulderX = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x)/2;
      const hipX = (lm[L.L_HIP].x + lm[L.R_HIP].x)/2;
      if(angle > 120 && Math.abs(shoulderX-hipX) > 0.10){
        return {warn:true, text:'Leaning back to press — brace your core and press straight overhead.', joints:[L.L_SHOULDER,L.R_SHOULDER,L.L_HIP,L.R_HIP]};
      }
      return null;
    }
  },
  tree: {
    label:'Tree Pose', unit:'sec held', hold:true, category:'yoga',
    joints:['L_HIP','L_KNEE','L_ANKLE','R_HIP','R_KNEE','R_ANKLE'],
    angleOf(lm){
      // Use whichever leg is straighter as the "standing" leg — the other
      // is expected to be lifted, so grading it the same way would misread
      // an intentional bend as a fault.
      const l = singleAngle(lm, L.L_HIP, L.L_KNEE, L.L_ANKLE);
      const r = singleAngle(lm, L.R_HIP, L.R_KNEE, L.R_ANKLE);
      if(l==null && r==null) return null;
      if(l==null) return r;
      if(r==null) return l;
      return Math.max(l, r);
    },
    holdMin:160, holdMax:185,
    formCheck(lm, angle){
      const shoulderX = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x)/2;
      const hipX = (lm[L.L_HIP].x + lm[L.R_HIP].x)/2;
      if(Math.abs(shoulderX-hipX) > 0.08){
        return {warn:true, text:'Wobbling — engage your core and fix your gaze on a point ahead.', joints:[L.L_SHOULDER,L.R_SHOULDER,L.L_HIP,L.R_HIP]};
      }
      return null;
    }
  },
  warrior2: {
    label:'Warrior II', unit:'sec held', hold:true, category:'yoga',
    joints:['L_HIP','L_KNEE','L_ANKLE','L_SHOULDER','L_WRIST','R_SHOULDER','R_WRIST'],
    angleOf(lm){ return singleAngle(lm, L.L_HIP, L.L_KNEE, L.L_ANKLE); },
    holdMin:75, holdMax:115, // front knee bent to roughly a right angle, held
    formCheck(lm, angle){
      const wristY = (lm[L.L_WRIST].y + lm[L.R_WRIST].y)/2;
      const shoulderY = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y)/2;
      if(Math.abs(wristY-shoulderY) > 0.12){
        return {warn:true, text:'Raise your arms to shoulder height, reaching wide through the fingertips.', joints:[L.L_WRIST,L.R_WRIST,L.L_SHOULDER,L.R_SHOULDER]};
      }
      return null;
    }
  }
};

/* ---------------------------------------------------------------------
   Flows — guided, timer + voice-paced sequences. Unlike Reps mode,
   these don't grade every rep: a few standing steps get a light
   "in position" hint from the camera, floor poses are paced only.
--------------------------------------------------------------------- */
function hintArmsOverhead(lm){
  const wristY = (lm[L.L_WRIST].y + lm[L.R_WRIST].y)/2;
  const shoulderY = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y)/2;
  return wristY < shoulderY - 0.05;
}
function hintForwardFold(lm){
  const angle = avgAngle(lm, L.L_SHOULDER,L.L_HIP,L.L_KNEE, L.R_SHOULDER,L.R_HIP,L.R_KNEE);
  return angle != null && angle < 100;
}
function hintStandingTall(lm){
  const angle = avgAngle(lm, L.L_SHOULDER,L.L_HIP,L.L_KNEE, L.R_SHOULDER,L.R_HIP,L.R_KNEE);
  return angle != null && angle > 155;
}
const FLOW_HINTS = { armsOverhead:hintArmsOverhead, forwardFold:hintForwardFold, standingTall:hintStandingTall };

const FLOWS = {
  surya: {
    label:'Surya Namaskar',
    steps:[
      { name:'Pranamasana', text:'Stand tall at the front of your mat, palms together at your chest.', hold:6, check:'standingTall' },
      { name:'Hasta Uttanasana', text:'Inhale — sweep your arms overhead, gentle backbend.', hold:5, check:'armsOverhead' },
      { name:'Hasta Padasana', text:'Exhale — fold forward, hands reaching toward the floor.', hold:5, check:'forwardFold' },
      { name:'Ashwa Sanchalanasana', text:'Step the right leg back into a low lunge, look up.', hold:5 },
      { name:'Dandasana (Plank)', text:'Step back into a straight-line plank.', hold:5 },
      { name:'Ashtanga Namaskara', text:'Lower your knees, chest, and chin to the floor.', hold:4 },
      { name:'Bhujangasana', text:'Slide forward and lift your chest — Cobra pose.', hold:5 },
      { name:'Adho Mukha Svanasana', text:'Lift your hips up and back — Downward-Facing Dog.', hold:6 },
      { name:'Ashwa Sanchalanasana', text:'Step the right foot forward into a low lunge, look up.', hold:5 },
      { name:'Hasta Padasana', text:'Step the left foot forward, fold, hands to the floor.', hold:5, check:'forwardFold' },
      { name:'Hasta Uttanasana', text:'Inhale — rise up, sweep arms overhead.', hold:5, check:'armsOverhead' },
      { name:'Pranamasana', text:'Exhale — return to standing, palms at your chest.', hold:6, check:'standingTall' }
    ]
  }
};

const CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[24,26],[26,28],
  [27,29],[29,31],[27,31],[28,30],[30,32],[28,32],
  [15,17],[15,19],[15,21],[16,18],[16,20],[16,22]
];

// Body segments drawn as thick, rounded "limbs" so it reads as a body,
// not a wireframe. Color groups the torso/arms/legs like a simple figure.
const BODY_SEGMENTS_3D = [
  { a:11, b:12, width:11, color:'#F2A93B' },  // shoulders
  { a:23, b:24, width:11, color:'#F2A93B' },  // hips
  { a:11, b:23, width:10, color:'#F2A93B' },  // torso left side
  { a:12, b:24, width:10, color:'#F2A93B' },  // torso right side
  { a:11, b:13, width:7,  color:'#57BFB6' },  // upper arm L
  { a:13, b:15, width:6,  color:'#57BFB6' },  // forearm L
  { a:12, b:14, width:7,  color:'#57BFB6' },  // upper arm R
  { a:14, b:16, width:6,  color:'#57BFB6' },  // forearm R
  { a:23, b:25, width:10, color:'#EFE8D8' },  // thigh L
  { a:25, b:27, width:8,  color:'#EFE8D8' },  // shin L
  { a:24, b:26, width:10, color:'#EFE8D8' },  // thigh R
  { a:26, b:28, width:8,  color:'#EFE8D8' },  // shin R
];

// A hardcoded standing figure, in the same coordinate space as the real
// world landmarks (meters, origin at hip center, y grows downward). Used
// so the 3D panel always shows a recognizable body — before the camera
// starts, between poses, or if a device can't produce real 3D data —
// instead of ever being an empty box.
const DEMO_WORLD_POSE = (()=>{
  const pts = {
    0:{x:0, y:-0.55, z:0},          // nose
    11:{x:-0.17, y:-0.33, z:0},     // L shoulder
    12:{x:0.17, y:-0.33, z:0},      // R shoulder
    13:{x:-0.22, y:-0.05, z:0.02},  // L elbow
    14:{x:0.22, y:-0.05, z:0.02},   // R elbow
    15:{x:-0.24, y:0.22, z:0.04},   // L wrist
    16:{x:0.24, y:0.22, z:0.04},    // R wrist
    23:{x:-0.10, y:0, z:0},         // L hip
    24:{x:0.10, y:0, z:0},          // R hip
    25:{x:-0.11, y:0.47, z:0.01},   // L knee
    26:{x:0.11, y:0.47, z:0.01},    // R knee
    27:{x:-0.11, y:0.90, z:0},      // L ankle
    28:{x:0.11, y:0.90, z:0}        // R ankle
  };
  const arr = new Array(33).fill(null);
  Object.keys(pts).forEach(i=> arr[i] = pts[i]);
  return arr;
})();

export {
  L, angleAt, avgAngle, singleAngle,
  EXERCISES, FLOW_HINTS, FLOWS, CONNECTIONS,
  BODY_SEGMENTS_3D, DEMO_WORLD_POSE
};

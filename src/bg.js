//Get context and screen size;
var ctx = cnv.getContext("2d");
var W = window.innerWidth;
var H = window.innerHeight;

//Set Canvas and Background Color;
cnv.width = W;
cnv.height = H;
ctx.fillStyle = "#121212";
ctx.fillRect(0, 0, W, H);

//Glow effect;
ctx.shadowBlur = 20;
ctx.shadowColor = "#e3e3e3";

function animate() {
  //Random position and size of stars;
  let x = W * Math.random();
  let y = H * Math.random();
  let r = 2.5 * Math.random();

  //Draw the stars;
  ctx.beginPath();
  ctx.fillStyle = "white";
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  setTimeout(animate, 200);
}
animate();

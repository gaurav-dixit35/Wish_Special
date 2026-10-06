// Keep sky keepsakes in the clear column beside the collection HUD.
export function skyLandmarks(width, height, mobile = false) {
  const moon = mobile
    ? {x:width - 30, y:Math.max(108, height * .13)}
    : {x:width - Math.max(45, width * .1), y:Math.max(80, height * .14)};
  return {
    moon,
    restingStar:{x:moon.x, y:moon.y + 72},
    wishes:{
      birthday:{x:moon.x, y:moon.y + 34},
      secret:{x:moon.x, y:moon.y + 108},
    },
  };
}

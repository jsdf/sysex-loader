export default function throttle(cb, time) {
  let timer = null;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (!timer) {
      timer = setTimeout(() => {
        cb(...lastArgs);
        timer = null;
        lastArgs = null;
      }, time);
    }
  };
}

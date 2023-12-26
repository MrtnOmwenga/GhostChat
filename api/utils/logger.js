/**
 * The function "info" logs the given parameters to the console, but only if the environment is not set
 * to "test".
 * @param params - The `params` parameter is a rest parameter that allows the function to accept any
 * number of arguments. It is represented by the `...` syntax and is used to gather all the arguments
 * passed to the function into an array.
 */
const info = (...params) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(...params);
  }
};

/**
 * The function logs the given parameters to the console if the environment is not set to 'test'.
 * @param params - The `params` parameter is a rest parameter that allows the function to accept any
 * number of arguments. It is an array-like object that contains all the arguments passed to the
 * function.
 */
const error = (...params) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(...params);
  }
};

/* `module.exports` is a special object in Node.js that is used to define the public interface of a
module. By assigning an object to `module.exports`, we are specifying what functions, objects, or
values should be accessible to other modules when they require or import this module. */
module.exports = {
  info,
  error,
};

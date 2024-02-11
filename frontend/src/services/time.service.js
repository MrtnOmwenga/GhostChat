// Get and return current time
const GetTime = () => {
  const date = new Date();
  const hour = date.getHours();
  let minute = date.getMinutes();

  if (minute <= 9) {
    minute = `0${minute}`;
  }

  return { hour, minute };
};

export default GetTime;

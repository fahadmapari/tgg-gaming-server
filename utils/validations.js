export const validateEmail = (email) => {
  const re =
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
};

export const changeNameForSocialLogin = (name) => {
  const regExp = new RegExp(" ", "g");
  let updatedName = name.replace(regExp, "");
  return (updatedName += Math.floor(Math.random() * 100));
};

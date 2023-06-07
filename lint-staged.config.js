module.exports = {
  'package/**/*.{js,jsx,ts,tsx}': [
    'npm run lint --workspace=@astral/mobx-query',
    () => 'npm run lint:types --workspace=@astral/mobx-query',
  ],

  'pack/**/*.{js}': ['npm run lint --workspace=@astral/pack'],

  'PRTitleLinter/**/*.{js}': ['npm run lint --workspace=@astral/PRTitleLinter'],
};

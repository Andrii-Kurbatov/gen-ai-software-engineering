const Joi = require('joi');
const cc = require('currency-codes');

const ACCOUNT_PATTERN = /^ACC-[A-Z0-9]{5}$/;

const accountField = (name) =>
  Joi.string().pattern(ACCOUNT_PATTERN)
    .messages({ 'string.pattern.base': `${name} must match format ACC-XXXXX (alphanumeric)` });

const transactionSchema = Joi.object({
  fromAccount: Joi.when('type', {
    switch: [
      { is: 'withdrawal', then: accountField('fromAccount').required() },
      { is: 'transfer',   then: accountField('fromAccount').required() },
    ],
    otherwise: Joi.forbidden(),
  }),
  toAccount: Joi.when('type', {
    switch: [
      { is: 'deposit',  then: accountField('toAccount').required() },
      { is: 'transfer', then: accountField('toAccount').required() },
    ],
    otherwise: Joi.forbidden(),
  }),
  amount: Joi.number().positive().required()
    .custom((value, helpers) => {
      if (Math.round(value * 100) / 100 !== value) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'number.positive': 'Amount must be a positive number',
      'any.invalid': 'Amount must have at most 2 decimal places',
      'any.required': 'Amount is required',
    }),
  currency: Joi.string().valid(...cc.codes()).required()
    .messages({
      'any.only': 'Invalid currency code',
      'any.required': 'Currency is required',
    }),
  type: Joi.string().valid('deposit', 'withdrawal', 'transfer').required()
    .messages({
      'any.only': 'Type must be deposit, withdrawal, or transfer',
      'any.required': 'Type is required',
    }),
});

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (!error) return next();

    res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      })),
    });
  };
}

module.exports = { ACCOUNT_PATTERN, transactionSchema, validate };

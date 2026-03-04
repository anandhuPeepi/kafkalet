package apperr

import (
	"errors"
	"fmt"
)

// Sentinel errors for programmatic handling.
var (
	ErrNotFound    = errors.New("not found")
	ErrValidation  = errors.New("validation")
	ErrConnection  = errors.New("connection failed")
	ErrAuth        = errors.New("authentication failed")
)

// NotFound wraps ErrNotFound with context.
func NotFound(entity, id string) error {
	return fmt.Errorf("%s %q: %w", entity, id, ErrNotFound)
}

// Validation wraps ErrValidation with a field-level message.
func Validation(field, reason string) error {
	return fmt.Errorf("%s: %s: %w", field, reason, ErrValidation)
}

// Required returns a validation error for an empty required field.
func Required(field string) error {
	return Validation(field, "required")
}

// Positive returns a validation error if value is not positive.
func Positive(field string) error {
	return Validation(field, "must be positive")
}

import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsString, Matches, MaxLength } from "class-validator";

export class ForgotPasswordDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email = "";
}

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/u, {
    message: "Reset link is invalid or expired.",
  })
  token = "";

  // The shared policy validates NFC-normalized Unicode character length.
  @IsString()
  @MaxLength(512)
  newPassword = "";

  @IsIn(["totp", "recovery_code"])
  verificationMethod: "totp" | "recovery_code" = "totp";

  @IsString()
  @Matches(
    /^(?:[0-9]{6}|[A-Za-z0-9_-]{5}-[A-Za-z0-9_-]{5}-[A-Za-z0-9_-]{4,5})$/u,
    { message: "Enter an authenticator code or a one-time recovery code." },
  )
  code = "";
}

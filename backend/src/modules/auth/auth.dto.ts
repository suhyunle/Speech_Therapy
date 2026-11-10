import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export const LOGIN_ID_RULE = /^[a-z0-9_]{4,20}$/;
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

export class SignUpDto {
  @ApiProperty({ example: 'malang01', description: '영문 소문자·숫자·_ 4~20자' })
  @Matches(LOGIN_ID_RULE, { message: '아이디는 영문 소문자·숫자 4~20자로 만들어요' })
  loginId: string;

  @ApiProperty({ example: 'abcd1234', description: '8자 이상, 영문·숫자 포함' })
  @Matches(PASSWORD_RULE, { message: '비밀번호는 8자 이상, 영문과 숫자를 넣어요' })
  password: string;

  @ApiProperty({ example: '수현', description: '앱에서 불러드릴 이름' })
  @IsString()
  @MinLength(1, { message: '이름을 적어주세요' })
  @MaxLength(30)
  name: string;

  @ApiProperty({ description: '(필수) 이용약관 · 개인정보 처리방침 동의' })
  @IsBoolean()
  agreeTerms: boolean;

  @ApiPropertyOptional({ example: 2001 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear?: number;

  @ApiPropertyOptional({ description: '만 14세 미만일 때 보호자 이름' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  guardianName?: string;

  @ApiPropertyOptional({ description: '만 14세 미만일 때 보호자 연락처' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guardianContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guardianAgree?: boolean;
}

export class LoginDto {
  @ApiProperty() @IsString() @MaxLength(20) loginId: string;
  @ApiProperty() @IsString() @MaxLength(64) password: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() refreshToken: string;
}

export class OAuthCallbackDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() state: string;
}

export class ProviderParam {
  @IsIn(['kakao', 'google']) provider: 'kakao' | 'google';
}

export class ChangePasswordDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) current?: string;
  @ApiProperty() @Matches(PASSWORD_RULE, { message: '비밀번호는 8자 이상, 영문과 숫자를 넣어요' }) next: string;
  @ApiPropertyOptional() @IsOptional() @Matches(LOGIN_ID_RULE, { message: '아이디는 영문 소문자·숫자 4~20자로 만들어요' }) loginId?: string;
}

// 테스트 전용: 실제 문제 파일을 그대로 읽어 쓴다. 앱 코드는 loadQuestions로 실행 중에 불러오므로 이 파일을 import하지 않는다.
import raw from '../../public/questions.json'
import { parseQuestions } from './questions'

export const questions = parseQuestions(raw)

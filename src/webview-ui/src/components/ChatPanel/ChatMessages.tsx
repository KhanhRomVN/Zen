import React, { useState } from "react";

interface Task {
  id: string;
  date: string;
  content: string;
  tokens: string;
}

const ChatMessages: React.FC = () => {
  const [tasks] = useState<Task[]>([
    {
      id: "1",
      date: "DECEMBER 3, 12:53 PM",
      content:
        'tôi muốn ở ZenCLI này giúp tôi thêm hệ thống context... trước tiên là làm hệ thống khi người dùng dùa ra 1 task nào đó thì sẽ kêm các context. đây là mẫu khi hỏi "thêm 1 hàm trừ 2 số nguyên cho file test.py, ko cần test file"...',
      tokens: "Tokens: +1.4m | 119.6k",
    },
    {
      id: "2",
      date: "DECEMBER 3, 12:41 PM",
      content:
        'tôi muốn ở ZenCLI này giúp tôi thêm hệ thống context... trước tiên là làm hệ thống khi người dùng dùa ra 1 task nào đó thì sẽ kêm các context. đây là mẫu khi hỏi "thêm 1 hàm trừ 2 số nguyên cho file test.py, ko cần test file"...',
      tokens: "Tokens: +180.2k | 7.6k",
    },
    {
      id: "3",
      date: "DECEMBER 3, 12:37 PM",
      content:
        'tôi muốn ở ZenCLI này giúp tôi thêm hệ thống context... trước tiên là làm hệ thống khi người dùng dùa ra 1 task nào đó thì sẽ kêm các context. đây là mẫu khi hỏi "thêm 1 hàm trừ 2 số nguyên cho file test.py, ko cần test file"...',
      tokens: "Tokens: +176.1k | 6.6k",
    },
  ]);

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="chat-messages">
      <div className="recent-tasks-section">
        <div
          className="recent-tasks-header"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span className="recent-tasks-title">RECENT TASKS</span>
        </div>

        {isExpanded && (
          <div className="recent-tasks-list">
            {tasks.map((task) => (
              <div key={task.id} className="task-item">
                <div className="task-date">{task.date}</div>
                <div className="task-content">{task.content}</div>
                <div className="task-tokens">{task.tokens}</div>
              </div>
            ))}
            <div className="view-all-history">
              <button className="view-all-btn">View all history</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessages;

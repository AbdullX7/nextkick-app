import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Play, Square, Users, Clock, Trophy, Crown, RotateCcw, ArrowUp, ArrowDown } from 'lucide-react';

const NextKickApp = () => {
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [matchDuration, setMatchDuration] = useState(5); // minutes
  const [gameMode, setGameMode] = useState('winnerStays'); // winnerStays, overflow
  const [overflowThreshold, setOverflowThreshold] = useState(6); // teams threshold for overflow mode
  const [fields, setFields] = useState([
    { id: 1, name: 'Field 1', currentMatch: null, queue: [], isActive: true },
    { id: 2, name: 'Field 2', currentMatch: null, queue: [], isActive: true },
    { id: 3, name: 'Field 3', currentMatch: null, queue: [], isActive: true }
  ]);
  const [globalQueue, setGlobalQueue] = useState([]);
  const [timers, setTimers] = useState({});

  // Timer effect for all fields
  useEffect(() => {
    const intervals = {};
    
    fields.forEach(field => {
      if (field.currentMatch && timers[field.id] > 0) {
        intervals[field.id] = setInterval(() => {
          setTimers(prev => {
            const newTime = (prev[field.id] || 0) - 1;
            if (newTime <= 0) {
              // Time's up - handle draw
              setTimeout(() => handleMatchEnd(field.id, 'draw'), 100);
              return { ...prev, [field.id]: 0 };
            }
            return { ...prev, [field.id]: newTime };
          });
        }, 1000);
      }
    });

    return () => {
      Object.values(intervals).forEach(interval => clearInterval(interval));
    };
  }, [fields, timers]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addTeam = () => {
    if (newTeamName.trim() && !teams.find(t => t.name === newTeamName.trim())) {
      const newTeam = {
        id: Date.now(),
        name: newTeamName.trim(),
        wins: 0,
        losses: 0,
        draws: 0
      };
      setTeams(prev => [...prev, newTeam]);
      setGlobalQueue(prev => [...prev, newTeam]);
      setNewTeamName('');
    }
  };

  const toggleField = (fieldId) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, isActive: !field.isActive } : field
    ));
  };

  const getActiveFields = () => fields.filter(f => f.isActive).sort((a, b) => a.id - b.id);

  const getNextAvailableTeams = () => {
    // Get teams not currently playing on any field
    const playingTeams = new Set();
    fields.forEach(field => {
      if (field.currentMatch) {
        playingTeams.add(field.currentMatch.team1.id);
        playingTeams.add(field.currentMatch.team2.id);
      }
    });
    
    return globalQueue.filter(team => !playingTeams.has(team.id));
  };

  const getCurrentGameMode = () => {
    if (gameMode === 'overflow' && teams.length >= overflowThreshold) {
      return 'overflow';
    }
    return 'winnerStays'; // Default to Winner Stays format
  };

  const startMatch = (fieldId) => {
    const availableTeams = getNextAvailableTeams();
    if (availableTeams.length >= 2) {
      const [team1, team2] = availableTeams.slice(0, 2);
      
      setFields(prev => prev.map(field => 
        field.id === fieldId ? {
          ...field,
          currentMatch: {
            team1: { ...team1, score: 0 },
            team2: { ...team2, score: 0 },
            startTime: Date.now()
          }
        } : field
      ));
      
      // Remove teams from global queue
      setGlobalQueue(prev => prev.filter(team => team.id !== team1.id && team.id !== team2.id));
      
      // Start timer for this field
      setTimers(prev => ({ ...prev, [fieldId]: matchDuration * 60 }));
    }
  };

  const scoreGoal = (fieldId, teamKey) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field?.currentMatch || !timers[fieldId]) return;
    
    setFields(prev => prev.map(field => {
      if (field.id !== fieldId) return field;
      
      const updated = { ...field };
      updated.currentMatch[teamKey].score += 1;
      
      // Check if match should end (2 goals)
      if (updated.currentMatch[teamKey].score >= 2) {
        const winner = teamKey;
        setTimeout(() => handleMatchEnd(fieldId, winner), 100);
      }
      
      return updated;
    }));
  };

  const handleMatchEnd = useCallback((fieldId, result) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field?.currentMatch) return;

    const { team1, team2 } = field.currentMatch;
    const currentMode = getCurrentGameMode();
    
    // Update team stats
    setTeams(prevTeams => prevTeams.map(team => {
      if (team.id === team1.id) {
        if (result === 'team1') return { ...team, wins: team.wins + 1 };
        if (result === 'team2') return { ...team, losses: team.losses + 1 };
        return { ...team, draws: team.draws + 1 };
      }
      if (team.id === team2.id) {
        if (result === 'team2') return { ...team, wins: team.wins + 1 };
        if (result === 'team1') return { ...team, losses: team.losses + 1 };
        return { ...team, draws: team.draws + 1 };
      }
      return team;
    }));

    // Handle queue logic based on current game mode
    if (currentMode === 'overflow') {
      // In overflow mode, both teams go to back of queue after every match
      setGlobalQueue(prev => [...prev, team1, team2]);
    } else {
      // Winner Stays format - winner stays to defend, loser goes to back
      if (result === 'draw') {
        // If tied, newest team (challenger/team2) is deemed winner
        setGlobalQueue(prev => [team2, ...prev, team1]);
      } else {
        const winner = result === 'team1' ? team1 : team2;
        const loser = result === 'team1' ? team2 : team1;
        // Winner stays on field (goes to front), loser goes to back
        setGlobalQueue(prev => [winner, ...prev, loser]);
      }
    }

    // Clear the match and timer for this field
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, currentMatch: null } : field
    ));
    
    setTimers(prev => ({ ...prev, [fieldId]: 0 }));
  }, [fields, gameMode, teams.length, overflowThreshold]);

  const resetApp = () => {
    setTeams([]);
    setGlobalQueue([]);
    setFields(prev => prev.map(field => ({ ...field, currentMatch: null })));
    setTimers({});
  };

  const shuffleQueue = () => {
    const shuffled = [...globalQueue].sort(() => Math.random() - 0.5);
    setGlobalQueue(shuffled);
  };

  const moveTeamInQueue = (teamId, direction) => {
    const currentIndex = globalQueue.findIndex(team => team.id === teamId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= globalQueue.length) return;
    
    const newQueue = [...globalQueue];
    [newQueue[currentIndex], newQueue[newIndex]] = [newQueue[newIndex], newQueue[currentIndex]];
    setGlobalQueue(newQueue);
  };

  const getGameModeDescription = () => {
    const currentMode = getCurrentGameMode();
    switch (currentMode) {
      case 'overflow':
        return {
          title: 'Overflow Mode (Active)',
          rules: [
            '• Both teams rotate to back of queue',
            '• Ensures equal playing time for all',
            '• No team defends when many players present',
            `• Active when ${overflowThreshold}+ teams present`
          ]
        };
      default: // winnerStays
        return {
          title: 'Winner Stays Format',
          rules: [
            '• Winner stays on field to take on next team',
            '• Loser goes to back of queue',
            '• If tied: newest team (challenger) wins',
            '• Game ends at 2 goals OR time limit',
            '• Duration: 5-8 min based on player count'
          ]
        };
    }
  };

  const modeInfo = getGameModeDescription();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Trophy className="text-yellow-300" size={40} />
            Winner Stays - Kraemer Fields
          </h1>
          <p className="text-white/80">Pick-up soccer games in "Winner Stays" format</p>
          <p className="text-white/60 text-sm mt-1">Organic soccer play • Free of coaches & referees • Pure freedom on the field</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Team Registration & Controls */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Users size={20} />
              Team Management
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTeam()}
                  placeholder="Enter team name"
                  className="flex-1 px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button
                  onClick={addTeam}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <label className="text-white/80 text-sm flex items-center gap-2">
                    <Clock size={16} />
                    Match Duration:
                  </label>
                  <input
                    type="number"
                    value={matchDuration}
                    onChange={(e) => setMatchDuration(Number(e.target.value))}
                    min="1"
                    max="20"
                    className="w-16 px-2 py-1 bg-white/20 border border-white/30 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <span className="text-white/80 text-sm">min</span>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <label className="text-white/80 text-sm">Game Mode:</label>
                    <select
                      value={gameMode}
                      onChange={(e) => setGameMode(e.target.value)}
                      className="px-3 py-1 bg-white/20 border border-white/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      <option value="winnerStays" className="bg-gray-800">Winner Stays</option>
                      <option value="overflow" className="bg-gray-800">Overflow</option>
                    </select>
                  </div>
                  
                  {gameMode === 'overflow' && (
                    <div className="flex gap-2 items-center">
                      <label className="text-white/80 text-xs">Threshold:</label>
                      <input
                        type="number"
                        value={overflowThreshold}
                        onChange={(e) => setOverflowThreshold(Number(e.target.value))}
                        min="4"
                        max="20"
                        className="w-12 px-1 py-1 bg-white/20 border border-white/30 rounded text-white text-center text-xs focus:outline-none focus:ring-2 focus:ring-white/50"
                      />
                      <span className="text-white/80 text-xs">teams</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white/80 text-sm">Active Fields:</label>
                <div className="flex gap-2">
                  {fields.map(field => (
                    <button
                      key={field.id}
                      onClick={() => toggleField(field.id)}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                        field.isActive 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-500 text-white/70'
                      }`}
                    >
                      {field.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={shuffleQueue}
                  disabled={globalQueue.length < 2}
                  className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw size={16} />
                  Shuffle
                </button>
                <button
                  onClick={resetApp}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Team List */}
            <div className="mt-4">
              <h3 className="text-white font-medium mb-2">Teams ({teams.length})</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {teams.map(team => (
                  <div key={team.id} className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-white font-medium text-sm">{team.name}</span>
                    <span className="text-white/70 text-xs">
                      {team.wins}W-{team.losses}L-{team.draws}D
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fields */}
          {getActiveFields().map((field, index) => {
            return (
              <div key={field.id} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Play size={20} />
                  {field.name}
                  {getCurrentGameMode() === 'overflow' && (
                    <span className="text-xs bg-purple-500 px-2 py-1 rounded text-white">OVERFLOW</span>
                  )}
                  {getCurrentGameMode() === 'winnerStays' && field.currentMatch && (
                    <span className="text-xs bg-green-500 px-2 py-1 rounded text-white">WINNER STAYS</span>
                  )}
                </h2>

                {field.currentMatch ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-2">
                        {formatTime(timers[field.id] || 0)}
                      </div>
                      <div className="text-white/70 text-sm">Time Remaining</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-center flex-1">
                        <div className="text-white font-semibold mb-1 text-sm">{field.currentMatch.team1.name}</div>
                        <div className="text-4xl font-bold text-white mb-2">{field.currentMatch.team1.score}</div>
                        <button
                          onClick={() => scoreGoal(field.id, 'team1')}
                          disabled={!timers[field.id]}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors text-sm"
                        >
                          Goal
                        </button>
                      </div>

                      <div className="text-white/50 text-xl font-bold mx-2">VS</div>

                      <div className="text-center flex-1">
                        <div className="text-white font-semibold mb-1 text-sm">{field.currentMatch.team2.name}</div>
                        <div className="text-4xl font-bold text-white mb-2">{field.currentMatch.team2.score}</div>
                        <button
                          onClick={() => scoreGoal(field.id, 'team2')}
                          disabled={!timers[field.id]}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors text-sm"
                        >
                          Goal
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => handleMatchEnd(field.id, 'team1')}
                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-xs"
                      >
                        {field.currentMatch.team1.name} Wins
                      </button>
                      <button
                        onClick={() => handleMatchEnd(field.id, 'draw')}
                        className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-xs"
                      >
                        Tied - Challenger Wins
                      </button>
                      <button
                        onClick={() => handleMatchEnd(field.id, 'team2')}
                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-xs"
                      >
                        {field.currentMatch.team2.name} Wins
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-white/60 mb-4 text-sm">No active match</div>
                    <button
                      onClick={() => startMatch(field.id)}
                      disabled={getNextAvailableTeams().length < 2}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto text-sm"
                    >
                      <Play size={16} />
                      Start Match
                    </button>
                    {getNextAvailableTeams().length < 2 && (
                      <div className="text-white/60 text-xs mt-2">
                        Need 2+ available teams
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Queue Display */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Crown size={20} />
              Global Queue ({globalQueue.length})
            </h2>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {globalQueue.length === 0 ? (
                <div className="text-white/60 text-center py-4 text-sm">
                  Queue is empty
                </div>
              ) : (
                globalQueue.map((team, index) => (
                  <div
                    key={`${team.id}-${index}`}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                      index === 0 ? 'bg-yellow-500/30 border border-yellow-400' :
                      index === 1 ? 'bg-green-500/30 border border-green-400' :
                      'bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-400 text-black' :
                        index === 1 ? 'bg-green-400 text-black' :
                        'bg-white/20 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="text-white font-medium text-sm">{team.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {index === 0 && (
                        <span className="text-yellow-400 text-xs font-semibold mr-2">
                          NEXT
                        </span>
                      )}
                      {index === 1 && (
                        <span className="text-green-400 text-xs font-semibold mr-2">
                          READY
                        </span>
                      )}
                      
                      {/* Queue management buttons */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveTeamInQueue(team.id, 'up')}
                          disabled={index === 0}
                          className="p-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-colors"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={() => moveTeamInQueue(team.id, 'down')}
                          disabled={index === globalQueue.length - 1}
                          className="p-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-colors"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Game Mode Info */}
            <div className="mt-4 p-3 bg-white/5 rounded-lg">
              <div className="text-white/80 text-sm">
                <strong className={getCurrentGameMode() === 'overflow' ? 'text-purple-400' : ''}>
                  {modeInfo.title}
                </strong>
                <ul className="mt-1 text-xs space-y-1">
                  {modeInfo.rules.map((rule, index) => (
                    <li key={index}>{rule}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

};

export default NextKickApp;
